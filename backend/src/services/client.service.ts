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
    
    // Saldo a favor por sector o consolidado
    const favorBlanco = Number(payload.saldo_a_favor_blanco || 0);
    const favorInterno = Number(payload.saldo_a_favor_interno || 0);
    if (payload.saldo_a_favor_blanco !== undefined || payload.saldo_a_favor_interno !== undefined) {
      payload.saldo_a_favor_blanco = favorBlanco;
      payload.saldo_a_favor_interno = favorInterno;
      payload.saldo_a_favor = favorBlanco + favorInterno;
    } else if (payload.saldo_a_favor !== undefined) {
      payload.saldo_a_favor = Number(payload.saldo_a_favor || 0);
      payload.saldo_a_favor_blanco = payload.saldo_a_favor;
      payload.saldo_a_favor_interno = 0;
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

    if (payload.saldo_a_favor_blanco && Number(payload.saldo_a_favor_blanco) > 0) {
      await prisma.payment.create({
        data: {
          client_id: client.id,
          monto_ars: Number(payload.saldo_a_favor_blanco),
          tipo: 'A_FAVOR',
          metodo_pago: 'SALDO_A_FAVOR',
          referencia: 'Carga inicial de saldo a favor fiscal'
        }
      });
    }

    if (payload.saldo_a_favor_interno && Number(payload.saldo_a_favor_interno) > 0) {
      await prisma.payment.create({
        data: {
          client_id: client.id,
          monto_ars: Number(payload.saldo_a_favor_interno),
          tipo: 'A_FAVOR',
          metodo_pago: 'SALDO_A_FAVOR',
          referencia: 'Carga inicial de saldo a favor interno'
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

    // Si se modificó el saldo a favor por sector o consolidado
    if (data.saldo_a_favor_blanco !== undefined || data.saldo_a_favor_interno !== undefined) {
      const oldBlancoFavor = Number(currentClient?.saldo_a_favor_blanco || 0);
      const oldInternoFavor = Number(currentClient?.saldo_a_favor_interno || 0);
      const newBlancoFavor = data.saldo_a_favor_blanco !== undefined ? Number(data.saldo_a_favor_blanco) : oldBlancoFavor;
      const newInternoFavor = data.saldo_a_favor_interno !== undefined ? Number(data.saldo_a_favor_interno) : oldInternoFavor;
      const diffBlanco = newBlancoFavor - oldBlancoFavor;
      const diffInterno = newInternoFavor - oldInternoFavor;

      payload.saldo_a_favor_blanco = newBlancoFavor;
      payload.saldo_a_favor_interno = newInternoFavor;
      payload.saldo_a_favor = newBlancoFavor + newInternoFavor;

      let fechaPagoFavor = new Date();
      if (fecha_saldo_a_favor) {
        fechaPagoFavor = new Date(String(fecha_saldo_a_favor).includes('T') ? String(fecha_saldo_a_favor) : `${fecha_saldo_a_favor}T12:00:00`);
        if (isNaN(fechaPagoFavor.getTime())) {
          fechaPagoFavor = new Date();
        }
      }

      if (diffBlanco !== 0) {
        const refText = motivo_saldo_a_favor && String(motivo_saldo_a_favor).trim()
          ? `Carga de Saldo a Favor [Fiscal]: ${String(motivo_saldo_a_favor).trim()}`
          : (diffBlanco > 0 ? 'Carga de Saldo a Favor [Fiscal]' : 'Ajuste de Saldo a Favor [Fiscal]');

        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: Math.abs(diffBlanco),
            tipo: 'A_FAVOR',
            metodo_pago: metodo_saldo_a_favor || 'SALDO_A_FAVOR',
            referencia: refText,
            fecha: fechaPagoFavor
          }
        });
      }

      if (diffInterno !== 0) {
        const refText = motivo_saldo_a_favor && String(motivo_saldo_a_favor).trim()
          ? `Carga de Saldo a Favor [Interno]: ${String(motivo_saldo_a_favor).trim()}`
          : (diffInterno > 0 ? 'Carga de Saldo a Favor [Interno]' : 'Ajuste de Saldo a Favor [Interno]');

        await prisma.payment.create({
          data: {
            client_id: id,
            monto_ars: Math.abs(diffInterno),
            tipo: 'A_FAVOR',
            metodo_pago: metodo_saldo_a_favor || 'SALDO_A_FAVOR',
            referencia: refText,
            fecha: fechaPagoFavor
          }
        });
      }

      await prisma.client.update({
        where: { id },
        data: {
          saldo_a_favor_blanco: newBlancoFavor,
          saldo_a_favor_interno: newInternoFavor,
          saldo_a_favor: newBlancoFavor + newInternoFavor
        }
      });
      updated.saldo_a_favor = (newBlancoFavor + newInternoFavor) as any;
      updated.saldo_a_favor_blanco = newBlancoFavor as any;
      updated.saldo_a_favor_interno = newInternoFavor as any;
    } else if (data.saldo_a_favor !== undefined) {
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
    tipo: 'BLANCO' | 'INTERNO' = 'BLANCO',
    motivo?: string,
    fecha?: string | Date,
    metodo: string = 'SALDO_A_FAVOR',
    modo: 'add' | 'direct' = 'add',
    applyDebtData?: {
      imputar_a_deuda?: boolean;
      deuda_referencia?: string;
      deuda_id?: string | number;
      deuda_monto?: number;
    }
  ) {
    const monto = parseArgNumber(rawMonto);
    if (isNaN(monto) || (modo === 'add' && monto <= 0) || (modo === 'direct' && monto < 0)) {
      throw new AppError('El monto debe ser un valor numérico válido mayor a 0', 400);
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

      let currentBlanco = Number(client.saldo_blanco);
      let currentInterno = Number(client.saldo_interno);
      let currentFavorBlanco = Number(client.saldo_a_favor_blanco || 0);
      let currentFavorInterno = Number(client.saldo_a_favor_interno || 0);

      const sectorLabel = tipo === 'BLANCO' ? 'Fiscal' : 'Interno';

      // CASO 1: Imputar a una factura o deuda existente usando el saldo a favor disponible
      if (applyDebtData?.imputar_a_deuda && applyDebtData.deuda_referencia) {
        const availableFavor = tipo === 'BLANCO' ? currentFavorBlanco : currentFavorInterno;
        if (availableFavor <= 0.001) {
          throw new AppError(`El cliente no cuenta con saldo a favor ${sectorLabel} disponible para imputar.`, 400);
        }

        const debtTargetMonto = applyDebtData.deuda_monto !== undefined && applyDebtData.deuda_monto > 0
          ? applyDebtData.deuda_monto
          : monto;

        // El monto a imputar no puede superar el crédito disponible ni lo solicitado
        const requestedMonto = Math.min(monto, debtTargetMonto);
        if (requestedMonto > availableFavor + 0.01) {
          throw new AppError(`El monto a imputar ($${requestedMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) supera el saldo a favor ${sectorLabel} disponible ($${availableFavor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}).`, 400);
        }

        const aImputar = Math.min(requestedMonto, availableFavor);

        // Deducir del crédito disponible del sector y amortizar la deuda
        if (tipo === 'BLANCO') {
          currentFavorBlanco = Math.max(0, currentFavorBlanco - aImputar);
          currentBlanco += aImputar; // reduce deuda negativa
        } else {
          currentFavorInterno = Math.max(0, currentFavorInterno - aImputar);
          currentInterno += aImputar; // reduce deuda negativa
        }

        // Crear pago de cancelación de la deuda con método SALDO_A_FAVOR
        const refDebt = applyDebtData.deuda_referencia.trim();
        const debtPaymentRef = refDebt.includes('Saldo a Favor') ? refDebt : `${refDebt} (Saldo a Favor)`;
        await tx.payment.create({
          data: {
            client_id: clientId,
            monto_ars: aImputar,
            tipo: tipo,
            metodo_pago: 'SALDO_A_FAVOR',
            referencia: debtPaymentRef,
            fecha: fechaMovimiento
          }
        });

        const newTotalDeuda = currentBlanco + currentInterno;
        const newTotalFavor = currentFavorBlanco + currentFavorInterno;

        const updated = await tx.client.update({
          where: { id: clientId },
          data: {
            saldo_blanco: currentBlanco,
            saldo_interno: currentInterno,
            saldo_deuda: newTotalDeuda,
            saldo_a_favor_blanco: currentFavorBlanco,
            saldo_a_favor_interno: currentFavorInterno,
            saldo_a_favor: newTotalFavor
          }
        });

        return updated;
      }

      // CASO 2: Carga pura de saldo a favor (queda acreditado en la cuenta)
      let diff = 0;
      if (tipo === 'BLANCO') {
        const newBlanco = modo === 'direct' ? monto : currentFavorBlanco + monto;
        diff = newBlanco - currentFavorBlanco;
        currentFavorBlanco = newBlanco;
      } else {
        const newInterno = modo === 'direct' ? monto : currentFavorInterno + monto;
        diff = newInterno - currentFavorInterno;
        currentFavorInterno = newInterno;
      }

      const newTotalFavor = currentFavorBlanco + currentFavorInterno;

      const updated = await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_a_favor_blanco: currentFavorBlanco,
          saldo_a_favor_interno: currentFavorInterno,
          saldo_a_favor: newTotalFavor
        }
      });

      if (diff !== 0) {
        const refFinal = motivo && String(motivo).trim()
          ? `Carga de Saldo a Favor [${sectorLabel}]: ${String(motivo).trim()}`
          : (diff > 0 ? `Carga de Saldo a Favor [${sectorLabel}]` : `Ajuste de Saldo a Favor [${sectorLabel}]`);

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

  static async imputeCredit(
    clientId: number,
    rawMonto: number | string,
    tipo: 'BLANCO' | 'INTERNO' = 'BLANCO',
    referencia: string = '',
    fecha?: string | Date
  ) {
    return await ClientService.loadCredit(clientId, rawMonto, tipo, '', fecha, 'SALDO_A_FAVOR', 'add', {
      imputar_a_deuda: true,
      deuda_referencia: referencia
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
    tipo: 'BLANCO' | 'INTERNO' | 'MIXTO' = 'BLANCO', 
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
      let newFavorBlanco = Number(client.saldo_a_favor_blanco || 0);
      let newFavorInterno = Number(client.saldo_a_favor_interno || 0);

      // Si el método de pago es SALDO_A_FAVOR, deducir del saldo a favor del sector
      if (metodo === 'SALDO_A_FAVOR') {
        if (tipo === 'BLANCO') {
          if (newFavorBlanco < (montoArs - 0.001)) {
            throw new AppError(`Saldo a favor fiscal insuficiente. Disponible: $${newFavorBlanco.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 400);
          }
          newFavorBlanco -= montoArs;
          newSaldoBlanco += montoArs;
        } else if (tipo === 'INTERNO') {
          if (newFavorInterno < (montoArs - 0.001)) {
            throw new AppError(`Saldo a favor interno insuficiente. Disponible: $${newFavorInterno.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 400);
          }
          newFavorInterno -= montoArs;
          newSaldoInterno += montoArs;
        } else {
          // MIXTO
          const totalFavor = newFavorBlanco + newFavorInterno;
          if (totalFavor < (montoArs - 0.001)) {
            throw new AppError(`Saldo a favor insuficiente. Disponible: $${totalFavor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 400);
          }
          let restante = montoArs;
          if (newFavorInterno > 0) {
            const deductInterno = Math.min(restante, newFavorInterno);
            newFavorInterno -= deductInterno;
            restante -= deductInterno;
          }
          if (restante > 0) {
            newFavorBlanco -= restante;
          }

          let restanteDeuda = montoArs;
          if (newSaldoInterno < 0) {
            const aSaldarInterno = Math.min(restanteDeuda, Math.abs(newSaldoInterno));
            newSaldoInterno += aSaldarInterno;
            restanteDeuda -= aSaldarInterno;
          }
          if (restanteDeuda > 0) {
            newSaldoBlanco += restanteDeuda;
          }
        }
      } else {
        // Métodos de cobro convencionales (Efectivo, Transferencia, Cheque, etc.)
        if (tipo === 'BLANCO') {
          newSaldoBlanco += montoArs;
        } else if (tipo === 'INTERNO') {
          newSaldoInterno += montoArs;
        } else {
          let restante = montoArs;
          if (newSaldoInterno < 0) {
            const aSaldarInterno = Math.min(restante, Math.abs(newSaldoInterno));
            newSaldoInterno += aSaldarInterno;
            restante -= aSaldarInterno;
          }
          if (restante > 0) {
            newSaldoBlanco += restante;
          }
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
          referencia: refFinal || (metodo === 'SALDO_A_FAVOR' ? 'Pago con Saldo a Favor' : ''),
          nro_cheque: extraData?.nro_cheque || null,
          fecha_vto_cheque: vtoCheque,
          caja: extraData?.caja || null,
          fecha: fechaPago
        }
      });

      // Sincronizar deuda total y saldo a favor total
      const newDeuda = newSaldoBlanco + newSaldoInterno;
      const newTotalFavor = newFavorBlanco + newFavorInterno;
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_blanco: newSaldoBlanco,
          saldo_interno: newSaldoInterno,
          saldo_deuda: newDeuda,
          saldo_a_favor_blanco: newFavorBlanco,
          saldo_a_favor_interno: newFavorInterno,
          saldo_a_favor: newTotalFavor
        }
      });

      return { payment, client: updatedClient };
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
      let newFavorBlanco = Number(client.saldo_a_favor_blanco || 0);
      let newFavorInterno = Number(client.saldo_a_favor_interno || 0);
      const monto = Number(payment.monto_ars);

      if (payment.tipo === 'A_FAVOR') {
        // Se borra una carga pura de saldo a favor
        const refLower = (payment.referencia || '').toLowerCase();
        if (refLower.includes('fiscal') || refLower.includes('blanco')) {
          newFavorBlanco = Math.max(0, newFavorBlanco - monto);
        } else if (refLower.includes('interno')) {
          newFavorInterno = Math.max(0, newFavorInterno - monto);
        } else {
          // Si no especifica, deducir de blanco o proporcional
          if (newFavorBlanco >= monto) {
            newFavorBlanco -= monto;
          } else {
            const rem = monto - newFavorBlanco;
            newFavorBlanco = 0;
            newFavorInterno = Math.max(0, newFavorInterno - rem);
          }
        }
      } else {
        // Se borra un pago que redujo la deuda
        if (payment.tipo === 'BLANCO') {
          newSaldoBlanco -= monto;
        } else {
          newSaldoInterno -= monto;
        }

        // Si fue pagado con SALDO_A_FAVOR, restaurar el crédito al cliente
        if (payment.metodo_pago === 'SALDO_A_FAVOR') {
          if (payment.tipo === 'BLANCO') {
            newFavorBlanco += monto;
          } else {
            newFavorInterno += monto;
          }
        }
      }

      await tx.payment.delete({ where: { id: paymentId } });
      
      const newDeuda = newSaldoBlanco + newSaldoInterno;
      const newTotalFavor = newFavorBlanco + newFavorInterno;
      await tx.client.update({
        where: { id: clientId },
        data: {
          saldo_blanco: newSaldoBlanco,
          saldo_interno: newSaldoInterno,
          saldo_deuda: newDeuda,
          saldo_a_favor_blanco: newFavorBlanco,
          saldo_a_favor_interno: newFavorInterno,
          saldo_a_favor: newTotalFavor
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
