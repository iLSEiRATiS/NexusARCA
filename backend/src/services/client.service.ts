import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

export class ClientService {
  static async getAll() {
    return await prisma.client.findMany({
      orderBy: { razon_social: 'asc' }
    });
  }

  static async getById(id: number) {
    return await prisma.client.findUnique({
      where: { id },
      include: {
        sales: { 
          take: 20, 
          orderBy: { fecha: 'desc' },
          include: { 
            items: { 
              include: { product: true } 
            } 
          }
        },
        payments: { take: 20, orderBy: { fecha: 'desc' } }
      }
    });
  }

  static async create(data: any) {
    return await prisma.client.create({
      data
    });
  }

  static async update(id: number, data: any) {
    return await prisma.client.update({
      where: { id },
      data
    });
  }

  static async delete(id: number) {
    return await prisma.client.delete({
      where: { id }
    });
  }

  static async getByCuit(cuit: string) {
    return await prisma.client.findUnique({
      where: { cuit }
    });
  }

  static async registerPayment(clientId: number, montoArs: number, tipo: 'BLANCO' | 'NEGRO' | 'MIXTO' = 'MIXTO', metodo: string = 'TRANSFERENCIA', referencia: string = '') {
    if (isNaN(montoArs) || montoArs <= 0) {
      throw new AppError('El monto debe ser un número positivo', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new AppError('Cliente no encontrado', 404);

      let newSaldoBlanco = Number(client.saldo_blanco);
      let newSaldoNegro = Number(client.saldo_negro);

      if (tipo === 'BLANCO') {
        newSaldoBlanco += montoArs; // Sumar para reducir deuda negativa
      } else if (tipo === 'NEGRO') {
        newSaldoNegro += montoArs;
      } else {
        // MIXTO: Salda primero Negro, remanente a Blanco
        let restante = montoArs;
        
        // Si el saldo negro es negativo (deuda), lo reducimos sumando
        if (newSaldoNegro < 0) {
          const aSaldarNegro = Math.min(restante, Math.abs(newSaldoNegro));
          newSaldoNegro += aSaldarNegro;
          restante -= aSaldarNegro;
        }
        
        // Si sobra dinero del cobro, lo aplicamos al blanco
        if (restante > 0) {
          newSaldoBlanco += restante;
        }
      }

      // Crear el registro de pago
      const payment = await tx.payment.create({
        data: {
          client_id: clientId,
          monto_ars: montoArs,
          tipo: tipo,
          metodo_pago: metodo,
          referencia: referencia,
          fecha: new Date()
        }
      });

      // Actualizar cliente con saldos sincronizados
      await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_blanco: newSaldoBlanco,
          saldo_negro: newSaldoNegro,
          saldo_deuda: newSaldoBlanco + newSaldoNegro
        }
      });

      return payment;
    });
  }

  static async syncBalance(clientId: number) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return;

    const total = Number(client.saldo_blanco) + Number(client.saldo_negro);
    await prisma.client.update({
      where: { id: clientId },
      data: { saldo_deuda: total }
    });
  }
}
