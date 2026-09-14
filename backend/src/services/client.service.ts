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
            items: true
          }
        },
        payments: { take: 20, orderBy: { fecha: 'desc' } }
      }
    });
  }

  static async create(data: any) {
    const cleanCuit = data.cuit ? String(data.cuit).replace(/[-\s.]/g, '') : '';
    const payload: any = {
      ...data,
      cuit: cleanCuit
    };

    if (payload.saldo_blanco !== undefined || payload.saldo_interno !== undefined) {
      payload.saldo_deuda = Number(payload.saldo_blanco || 0) + Number(payload.saldo_interno || 0);
    }

    // Convertir strings vacíos a null para campos opcionales
    if (payload.email === '') payload.email = null;
    if (payload.direccion === '') payload.direccion = null;
    if (payload.nro_iibb === '') payload.nro_iibb = null;
    if (payload.telefono === '') payload.telefono = null;

    const client = await prisma.client.create({
      data: payload
    });
    
    if (payload.saldo_blanco && Number(payload.saldo_blanco) !== 0) {
      await prisma.payment.create({
        data: {
          client_id: client.id,
          monto_ars: Number(payload.saldo_blanco),
          tipo: 'BLANCO',
          metodo_pago: 'SALDO_PREVIO',
          referencia: 'Carga de saldo inicial blanco'
        }
      });
    }
    
    if (payload.saldo_interno && Number(payload.saldo_interno) !== 0) {
      await prisma.payment.create({
        data: {
          client_id: client.id,
          monto_ars: Number(payload.saldo_interno),
          tipo: 'INTERNO',
          metodo_pago: 'SALDO_PREVIO',
          referencia: 'Carga de saldo inicial interno'
        }
      });
    }
    return client;
  }

  static async update(id: number, data: any) {
    const currentClient = await prisma.client.findUnique({ where: { id } });
    
    const updated = await prisma.client.update({
      where: { id },
      data
    });
    
    // Si se modificaron los saldos, sincronizamos la deuda total
    if (data.saldo_blanco !== undefined || data.saldo_interno !== undefined) {
      const oldBlanco = Number(currentClient?.saldo_blanco || 0);
      const oldInterno = Number(currentClient?.saldo_interno || 0);
      
      const newBlanco = Number(updated.saldo_blanco);
      const newInterno = Number(updated.saldo_interno);
      
      const diffBlanco = newBlanco - oldBlanco;
      const diffInterno = newInterno - oldInterno;

      if (diffBlanco !== 0) {
        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: diffBlanco,
            tipo: 'BLANCO',
            metodo_pago: 'AJUSTE_SALDO',
            referencia: 'Ajuste manual de saldo blanco'
          }
        });
      }

      if (diffInterno !== 0) {
        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: diffInterno,
            tipo: 'INTERNO',
            metodo_pago: 'AJUSTE_SALDO',
            referencia: 'Ajuste manual de saldo interno'
          }
        });
      }

      const total = newBlanco + newInterno;
      await prisma.client.update({
        where: { id },
        data: { saldo_deuda: total }
      });
      
      updated.saldo_deuda = total as any;
    }
    return updated;
  }

  static async delete(id: number) {
    return await prisma.client.delete({
      where: { id }
    });
  }

  static async getByCuit(cuit: string) {
    if (!cuit) return null;
    const cleanCuit = String(cuit).replace(/[-\s.]/g, '');
    return await prisma.client.findFirst({
      where: {
        OR: [
          { cuit: cleanCuit },
          { cuit: cuit }
        ]
      }
    });
  }

  static async registerPayment(clientId: number, montoArs: number, tipo: 'BLANCO' | 'INTERNO' | 'MIXTO' = 'MIXTO', metodo: string = 'TRANSFERENCIA', referencia: string = '') {
    if (isNaN(montoArs) || montoArs <= 0) {
      throw new AppError('El monto debe ser un número positivo', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new AppError('Cliente no encontrado', 404);

      let newSaldoBlanco = Number(client.saldo_blanco);
      let newSaldoInterno = Number(client.saldo_interno);

      if (tipo === 'BLANCO') {
        newSaldoBlanco += montoArs; // Sumar para reducir deuda negativa
      } else if (tipo === 'INTERNO') {
        newSaldoInterno += montoArs;
      } else {
        // MIXTO: Salda primero Interno, remanente a Blanco
        let restante = montoArs;
        
        // Si el saldo negro es negativo (deuda), lo reducimos sumando
        if (newSaldoInterno < 0) {
          const aSaldarInterno = Math.min(restante, Math.abs(newSaldoInterno));
          newSaldoInterno += aSaldarInterno;
          restante -= aSaldarInterno;
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

      // Sincronizar deuda total
      const newDeuda = newSaldoBlanco + newSaldoInterno;
      await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_blanco: newSaldoBlanco,
          saldo_interno: newSaldoInterno,
          saldo_deuda: newDeuda
        }
      });

      return payment;
    });
  }

  static async deletePayment(clientId: number, paymentId: number) {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.client_id !== clientId) {
        throw new AppError('Pago/Ajuste no encontrado', 404);
      }

      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new AppError('Cliente no encontrado', 404);

      let newSaldoBlanco = Number(client.saldo_blanco);
      let newSaldoInterno = Number(client.saldo_interno);
      const monto = Number(payment.monto_ars);

      if (payment.tipo === 'BLANCO') {
        newSaldoBlanco -= monto;
      } else {
        newSaldoInterno -= monto;
      }

      await tx.payment.delete({ where: { id: paymentId } });
      
      const newDeuda = newSaldoBlanco + newSaldoInterno;
      await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_blanco: newSaldoBlanco,
          saldo_interno: newSaldoInterno,
          saldo_deuda: newDeuda
        }
      });

      return { success: true };
    });
  }

  static async syncBalance(clientId: number) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return;

    const total = Number(client.saldo_blanco) + Number(client.saldo_interno);
    await prisma.client.update({
      where: { id: clientId },
      data: { saldo_deuda: total }
    });
  }
}
