import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { parseArgNumber } from '../utils/format';

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
          take: 100, 
          orderBy: { fecha: 'desc' },
          include: { 
            items: true
          }
        },
        payments: { take: 100, orderBy: { fecha: 'desc' } }
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
    if (payload.saldo_a_favor !== undefined) {
      payload.saldo_a_favor = Number(payload.saldo_a_favor || 0);
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

    if (payload.saldo_a_favor && Number(payload.saldo_a_favor) > 0) {
      await prisma.payment.create({
        data: {
          client_id: client.id,
          monto_ars: Number(payload.saldo_a_favor),
          tipo: 'A_FAVOR',
          metodo_pago: 'SALDO_A_FAVOR',
          referencia: 'Carga de saldo inicial a favor'
        }
      });
    }

    return client;
  }

  static async update(id: number, data: any) {
    const currentClient = await prisma.client.findUnique({ where: { id } });
    if (!currentClient) {
      throw new AppError('Cliente no encontrado', 404);
    }

    const { 
      nro_factura, 
      fecha_factura, 
      nro_remito, 
      fecha_remito, 
      motivo_saldo_a_favor, 
      fecha_saldo_a_favor, 
      metodo_saldo_a_favor, 
      ...clientData 
    } = data;

    const payload: any = { ...clientData };
    if (payload.cuit) {
      payload.cuit = String(payload.cuit).replace(/[-\s.]/g, '');
    }
    if (payload.email === '') payload.email = null;
    if (payload.direccion === '') payload.direccion = null;
    if (payload.nro_iibb === '') payload.nro_iibb = null;
    if (payload.telefono === '') payload.telefono = null;
    if (payload.saldo_a_favor !== undefined) {
      payload.saldo_a_favor = Number(payload.saldo_a_favor);
    }
    if (payload.porcentaje_facturacion !== undefined) {
      payload.porcentaje_facturacion = Number(payload.porcentaje_facturacion);
    }
    
    const updated = await prisma.client.update({
      where: { id },
      data: payload
    });
    
    // Si se modificaron los saldos blanco o interno, sincronizamos la deuda total
    if (data.saldo_blanco !== undefined || data.saldo_interno !== undefined) {
      const oldBlanco = Number(currentClient?.saldo_blanco || 0);
      const oldInterno = Number(currentClient?.saldo_interno || 0);
      
      const newBlanco = Number(updated.saldo_blanco);
      const newInterno = Number(updated.saldo_interno);
      
      const diffBlanco = newBlanco - oldBlanco;
      const diffInterno = newInterno - oldInterno;

      if (diffBlanco !== 0) {
        let referenciaBlanco = 'Ajuste manual de saldo blanco';
        if (nro_factura && String(nro_factura).trim()) {
          const trimmedFactura = String(nro_factura).trim();
          referenciaBlanco = trimmedFactura.toLowerCase().startsWith('factura')
            ? trimmedFactura
            : `Factura N° ${trimmedFactura}`;
        }

        let fechaPago = new Date();
        if (fecha_factura) {
          fechaPago = new Date(String(fecha_factura).includes('T') ? String(fecha_factura) : `${fecha_factura}T12:00:00`);
          if (isNaN(fechaPago.getTime())) {
            fechaPago = new Date();
          }
        }

        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: diffBlanco,
            tipo: 'BLANCO',
            metodo_pago: 'AJUSTE_SALDO',
            referencia: referenciaBlanco,
            fecha: fechaPago
          }
        });
      }

      if (diffInterno !== 0) {
        let referenciaInterno = 'Ajuste manual de saldo interno';
        if (nro_remito && String(nro_remito).trim()) {
          const trimmedRemito = String(nro_remito).trim();
          referenciaInterno = (trimmedRemito.toLowerCase().startsWith('remito') || trimmedRemito.toLowerCase().startsWith('comp'))
            ? trimmedRemito
            : `Remito N° ${trimmedRemito}`;
        }

        let fechaPagoInterno = new Date();
        if (fecha_remito) {
          fechaPagoInterno = new Date(String(fecha_remito).includes('T') ? String(fecha_remito) : `${fecha_remito}T12:00:00`);
          if (isNaN(fechaPagoInterno.getTime())) {
            fechaPagoInterno = new Date();
          }
        }

        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: diffInterno,
            tipo: 'INTERNO',
            metodo_pago: 'AJUSTE_SALDO',
            referencia: referenciaInterno,
            fecha: fechaPagoInterno
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

    // Si se modificó el saldo a favor
    if (data.saldo_a_favor !== undefined) {
      const oldFavor = Number(currentClient?.saldo_a_favor || 0);
      const newFavor = Number(updated.saldo_a_favor);
      const diffFavor = newFavor - oldFavor;

      if (diffFavor !== 0) {
        let fechaPagoFavor = new Date();
        if (fecha_saldo_a_favor) {
          fechaPagoFavor = new Date(String(fecha_saldo_a_favor).includes('T') ? String(fecha_saldo_a_favor) : `${fecha_saldo_a_favor}T12:00:00`);
          if (isNaN(fechaPagoFavor.getTime())) {
            fechaPagoFavor = new Date();
          }
        }

        const refText = motivo_saldo_a_favor && String(motivo_saldo_a_favor).trim()
          ? `Carga de Saldo a Favor: ${String(motivo_saldo_a_favor).trim()}`
          : (diffFavor > 0 ? 'Carga de Saldo a Favor' : 'Ajuste de Saldo a Favor');

        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: Math.abs(diffFavor),
            tipo: 'A_FAVOR',
            metodo_pago: metodo_saldo_a_favor || 'SALDO_A_FAVOR',
            referencia: refText,
            fecha: fechaPagoFavor
          }
        });
      }
    }

    return updated;
  }

  static async loadCredit(
    clientId: number,
    rawMonto: number | string,
    motivo?: string,
    fecha?: string | Date,
    metodo: string = 'SALDO_A_FAVOR',
    modo: 'add' | 'direct' = 'add'
  ) {
    const monto = parseArgNumber(rawMonto);
    if (isNaN(monto) || monto < 0) {
      throw new AppError('El monto debe ser un valor numérico válido mayor o igual a 0', 400);
    }

    let fechaMovimiento = new Date();
    if (fecha) {
      fechaMovimiento = new Date(String(fecha).includes('T') ? String(fecha) : `${fecha}T12:00:00`);
      if (isNaN(fechaMovimiento.getTime())) {
        fechaMovimiento = new Date();
      }
    }

    return await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new AppError('Cliente no encontrado', 404);

      const currentFavor = Number(client.saldo_a_favor || 0);
      const newFavor = modo === 'direct' ? monto : currentFavor + monto;
      const diff = newFavor - currentFavor;

      const updated = await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_a_favor: newFavor
        }
      });

      if (diff !== 0) {
        const refFinal = motivo && String(motivo).trim()
          ? `Carga de Saldo a Favor: ${String(motivo).trim()}`
          : (diff > 0 ? 'Carga de Saldo a Favor' : 'Ajuste de Saldo a Favor');

        await tx.payment.create({
          data: {
            client_id: clientId,
            monto_ars: Math.abs(diff),
            tipo: 'A_FAVOR',
            metodo_pago: metodo || 'SALDO_A_FAVOR',
            referencia: refFinal,
            fecha: fechaMovimiento
          }
        });
      }

      return updated;
    });
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

  static async registerPayment(
    clientId: number, 
    montoArs: number, 
    tipo: 'BLANCO' | 'INTERNO' | 'MIXTO' = 'MIXTO', 
    metodo: string = 'TRANSFERENCIA', 
    referencia: string = '', 
    fecha?: Date | string,
    extraData?: {
      nro_cheque?: string;
      fecha_vto_cheque?: Date | string;
      caja?: string;
    }
  ) {
    if (isNaN(montoArs) || montoArs <= 0) {
      throw new AppError('El monto debe ser un número positivo', 400);
    }

    let fechaPago = new Date();
    if (fecha) {
      fechaPago = new Date(String(fecha).includes('T') ? String(fecha) : `${fecha}T12:00:00`);
      if (isNaN(fechaPago.getTime())) {
        fechaPago = new Date();
      }
    }

    let vtoCheque: Date | null = null;
    if (extraData?.fecha_vto_cheque) {
      const parsedVto = new Date(String(extraData.fecha_vto_cheque).includes('T') ? String(extraData.fecha_vto_cheque) : `${extraData.fecha_vto_cheque}T12:00:00`);
      if (!isNaN(parsedVto.getTime())) {
        vtoCheque = parsedVto;
      }
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

      // Si es cheque y tiene datos, formatear referencia informativa
      let refFinal = referencia ? referencia.trim() : '';
      if (['CHEQUE', 'CHEQUE_ELECTRONICO'].includes(metodo)) {
        const chequeLabel = metodo === 'CHEQUE_ELECTRONICO' ? 'E-Cheq' : 'Cheque';
        const partes: string[] = [];
        if (extraData?.nro_cheque) partes.push(`N° ${extraData.nro_cheque}`);
        if (vtoCheque) partes.push(`Vto: ${vtoCheque.toLocaleDateString('es-AR')}`);
        if (extraData?.caja) partes.push(`Caja: ${extraData.caja}`);
        
        if (partes.length > 0) {
          const infoExtra = `[${chequeLabel} ${partes.join(' • ')}]`;
          if (!refFinal) {
            refFinal = infoExtra;
          } else if (!refFinal.includes(extraData?.nro_cheque || '___')) {
            refFinal = `${refFinal} ${infoExtra}`;
          }
        }
      }

      // Crear el registro de pago
      const payment = await tx.payment.create({
        data: {
          client_id: clientId,
          monto_ars: montoArs,
          tipo: tipo,
          metodo_pago: metodo,
          referencia: refFinal,
          nro_cheque: extraData?.nro_cheque || null,
          fecha_vto_cheque: vtoCheque,
          caja: extraData?.caja || null,
          fecha: fechaPago
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
