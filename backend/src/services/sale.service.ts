import prisma from '../config/prisma';
import { CurrencyService } from './currency.service';
import { AfipService } from './afip.service';
import { AppError } from '../utils/AppError';

export class SaleService {
  /**
   * Procesa la facturación de una venta ya creada (PENDIENTE → FACTURADO o REMITO).
   * Si se especificó cobro interno (monto_interno) o el usuario ajustó los precios a la baja,
   * emite la Factura Oficial por la porción en blanco ante ARCA y genera automáticamente
   * una Factura de Remito / Gestión Comercial por la porción en negro (interno).
   */
  static async processBilling(
    saleId: number, 
    mode: 'ARCA' | 'REMITO' = 'ARCA', 
    impactBalance: boolean = true,
    customPrices?: Record<number, { price: number, currency: 'USD' | 'ARS' }>,
    cotizacion_usada: number = 1000,
    percepciones_iibb_ars: number = 0,
    percepciones_iva_ars: number = 0,
    monto_interno?: number
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { client: true, items: true }
    });

    if (!sale) throw new AppError('Venta no encontrada', 404);
    if (mode === 'ARCA' && sale.cae) throw new AppError('La venta ya posee CAE asignado', 400);

    return await prisma.$transaction(async (tx) => {
      // 1. Calcular subtotal neto y total original (precios originales sin ajustar)
      let subtotal_original_ars = 0;
      let total_original_ars = 0;

      for (const item of sale.items) {
        const precio_original_ars = Number(item.precio_unitario_ars);
        const precio_original_usd = Number(item.precio_unitario_usd);
        (item as any).precio_original_ars_backup = precio_original_ars;
        (item as any).precio_original_usd_backup = precio_original_usd;

        const cantidad_num = Number(item.cantidad);
        const subtotal_item = precio_original_ars * cantidad_num;
        const iva_item = subtotal_item * (Number(item.iva_tasa) / 100);

        subtotal_original_ars += subtotal_item;
        total_original_ars += (subtotal_item + iva_item);
      }

      // 2. Determinar monto interno a descontar del neto
      const target_monto_interno = (monto_interno !== undefined && monto_interno >= 0)
        ? Number(monto_interno)
        : Number(sale.monto_no_facturado_ars || 0);

      const hasCustomPrices = customPrices && Object.keys(customPrices).length > 0;
      
      // El monto interno se descuenta del NETO original:
      // Ejemplo: subtotal_original_ars = 1000, target_monto_interno = 500
      // neto_oficial_objetivo = 1000 - 500 = 500
      // autoRatio = 500 / 1000 = 0.5
      let autoRatio = 1;
      if (!hasCustomPrices && target_monto_interno > 0 && subtotal_original_ars > 0) {
        const neto_oficial_objetivo = Math.max(0, subtotal_original_ars - target_monto_interno);
        autoRatio = neto_oficial_objetivo / subtotal_original_ars;
      }

      // 3. Calcular precios ajustados para la factura oficial (lo que va a ARCA)
      let total_real_ars = 0;
      let subtotal_ars = 0;
      let iva_ars = 0;

      for (const item of sale.items) {
        const precio_original_ars = (item as any).precio_original_ars_backup;
        const cantidad_num = Number(item.cantidad);

        let precio_unitario_ars = precio_original_ars;
        let precio_unitario_usd = (item as any).precio_original_usd_backup;

        if (hasCustomPrices && customPrices![item.id]) {
          const config = customPrices![item.id];
          if (config.currency === 'USD') {
            precio_unitario_usd = Number(config.price);
            precio_unitario_ars = precio_unitario_usd * cotizacion_usada;
          } else {
            precio_unitario_ars = Number(config.price);
            precio_unitario_usd = precio_unitario_ars / cotizacion_usada;
          }
        } else if (autoRatio < 1) {
          // Aplica el ratio al neto
          precio_unitario_ars = precio_original_ars * autoRatio;
          precio_unitario_usd = (item as any).precio_original_usd_backup * autoRatio;
        }

        const subtotal_item = precio_unitario_ars * cantidad_num;
        const iva_item = subtotal_item * (Number(item.iva_tasa) / 100);

        total_real_ars += (subtotal_item + iva_item);
        subtotal_ars += subtotal_item;
        iva_ars += iva_item;

        (item as any).iva_importe_ars = iva_item;
        (item as any).precio_unitario_ars = precio_unitario_ars;

        await tx.saleItem.update({
          where: { id: item.id },
          data: { 
            precio_unitario_ars, 
            precio_unitario_usd,
            iva_importe_ars: iva_item
          }
        });
      }

      total_real_ars += percepciones_iibb_ars + percepciones_iva_ars;

      let updateData: any = {
        total_real_ars,
        subtotal_ars,
        iva_ars,
        percepciones_iibb_ars,
        percepciones_iva_ars,
        cotizacion_dolar_usada: cotizacion_usada
      };

      let remitoInterno: any = null;
      const diferencial_neto = Math.max(0, subtotal_original_ars - subtotal_ars);
      const tieneDiferencial = mode === 'ARCA' && diferencial_neto > 0.05;

      if (mode === 'ARCA') {
        let tipoComprobante = sale.tipo_comprobante;
        
        // Si originalmente era un Remito pero se está procesando por ARCA, asignar Factura A o B automáticamente
        if (tipoComprobante === 'Remito') {
           tipoComprobante = ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(sale.client?.condicion_iva || '') 
             ? 'Factura A' 
             : 'Factura B';
        }

        // VALIDACIÓN LEGAL: Condición IVA ↔ Tipo Comprobante
        if (tipoComprobante === 'Factura A' && 
            !['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(sale.client?.condicion_iva || '')) {
          throw new AppError(
            `No se puede emitir Factura A para un cliente con condición IVA "${sale.client?.condicion_iva}". Solo Responsable Inscripto y Monotributo pueden recibir Facturas A.`,
            400
          );
        }

        const saleForAfip = { 
          ...sale, 
          items: sale.items,
          monto_facturado_ars: total_real_ars, 
          subtotal_ars, 
          iva_ars,
          percepciones_iibb_ars,
          percepciones_iva_ars,
          tipo_comprobante: tipoComprobante,
        };
        const afipResult = await AfipService.createInvoice(saleForAfip as any);
        
        if (!afipResult?.cae || !afipResult?.vto_cae) {
          throw new AppError('No se obtuvo CAE de AFIP para autorizar el comprobante.', 400);
        }

        updateData = {
          ...updateData,
          cae: afipResult.cae,
          vto_cae: new Date(afipResult.vto_cae),
          nro_comprobante: afipResult.nro_comprobante,
          estado_factura: 'FACTURADO',
          tipo_comprobante: tipoComprobante,
          monto_facturado_ars: total_real_ars,
          monto_no_facturado_ars: tieneDiferencial ? diferencial_neto : 0,
          porcentaje_split: subtotal_original_ars > 0 ? (subtotal_ars / subtotal_original_ars) * 100 : 100
        };

        // ── SPLIT AUTOMÁTICO: Crear Remito / Gestión Comercial por el diferencial en negro ──
        if (tieneDiferencial) {
          console.log(`[SaleService] Cobro Interno detectado: $${diferencial_neto.toFixed(2)} → Creando Remito / Gestión Comercial`);
          
          const ratio_diferencial = diferencial_neto / subtotal_original_ars;
          const difItems = sale.items.map(item => ({
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            precio_unitario_ars: (item as any).precio_original_ars_backup * ratio_diferencial,
            precio_unitario_usd: (item as any).precio_original_usd_backup * ratio_diferencial,
            iva_tasa: 0,
            iva_importe_ars: 0
          }));

          remitoInterno = await tx.sale.create({
            data: {
              client_id: sale.client_id,
              nro_comprobante: `REM-${saleId}`,
              total_real_ars: diferencial_neto,
              cotizacion_dolar_usada: cotizacion_usada,
              monto_facturado_ars: 0,
              monto_no_facturado_ars: diferencial_neto,
              porcentaje_split: 0,
              subtotal_ars: diferencial_neto,
              iva_ars: 0,
              tipo_comprobante: 'Remito',
              estado_factura: 'FACTURADO',
              fecha_vto_pago: sale.fecha_vto_pago,
              items: {
                create: difItems
              }
            }
          });
        }
      } else {
        // Modo REMITO puro: todo va sin facturar
        updateData = {
          ...updateData,
          tipo_comprobante: 'Remito',
          estado_factura: 'FACTURADO',
          monto_facturado_ars: 0,
          monto_no_facturado_ars: total_real_ars,
          porcentaje_split: 0
        };
      }

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: updateData,
        include: { client: true, items: true }
      });

      if (impactBalance) {
        if (mode === 'ARCA') {
          // saldo_blanco: solo la porción oficial ARCA (total_real_ars, ej: $605)
          // saldo_interno: porción interna / remito (diferencial_neto, ej: $500)
          // saldo_deuda: suma total real ($605 + $500 = $1105)
          await tx.client.update({
            where: { id: updatedSale.client_id },
            data: {
              saldo_blanco: { decrement: total_real_ars },
              saldo_interno: tieneDiferencial ? { decrement: diferencial_neto } : undefined,
              saldo_deuda: { decrement: total_real_ars + (tieneDiferencial ? diferencial_neto : 0) }
            }
          });
        } else {
          // Modo REMITO puro
          await tx.client.update({
            where: { id: updatedSale.client_id },
            data: {
              saldo_interno: { decrement: total_real_ars },
              saldo_deuda: { decrement: total_real_ars }
            }
          });
        }
      }

      return {
        ...updatedSale,
        remito_interno: remitoInterno
      };
    });
  }

  /**
   * Crea una venta y la procesa de un solo tirón:
   * - Si es Factura A o B: emite ante ARCA (obtiene CAE) y, si hay cobro interno,
   *   crea simultáneamente el Remito Interno por el diferencial.
   * - Si es Remito: emite el Remito directo sin pasar por ARCA.
   */
  static async create(data: {
    client_id?: number;
    cuit?: string;
    items: { descripcion: string; cantidad: number; precio_unitario_usd: number; iva_tasa: number }[];
    tipo_comprobante: string;
    fecha_vto_pago?: string;
    percepciones_iibb_ars?: number;
    percepciones_iva_ars?: number;
    monto_interno?: number; // Monto explícito a cobrar en negro (descontado del neto)
  }) {
    const { items, tipo_comprobante, fecha_vto_pago, monto_interno } = data;
    const cotizacion = await CurrencyService.getDolarOficial();
    
    let client;
    if (data.client_id) {
      client = await prisma.client.findUnique({ where: { id: data.client_id } });
    } else if (data.cuit) {
      const cleanCuit = String(data.cuit).replace(/[-\s.]/g, '');
      client = await prisma.client.findFirst({
        where: {
          OR: [
            { cuit: cleanCuit },
            { cuit: data.cuit }
          ]
        }
      });
    }
    
    if (!client) {
      throw new AppError(
        'El CUIT ingresado no corresponde a ningún cliente registrado. Cargue el cliente primero desde la sección de Clientes con su Razón Social y Condición IVA correctos.',
        404
      );
    }

    const client_id = client.id;

    let total_real_ars = 0;
    let total_subtotal_ars = 0;
    let total_iva_ars = 0;
    const saleItemsData = [];

    for (const item of items) {
      const precioUnitarioArs = item.precio_unitario_usd * cotizacion;
      const neto_item = precioUnitarioArs * item.cantidad;
      const iva_item = neto_item * (item.iva_tasa / 100);
      
      total_real_ars += (neto_item + iva_item);
      total_subtotal_ars += neto_item;
      total_iva_ars += iva_item;

      saleItemsData.push({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario_ars: precioUnitarioArs, 
        precio_unitario_usd: item.precio_unitario_usd, 
        iva_tasa: item.iva_tasa,
        iva_importe_ars: iva_item
      });
    }

    let monto_no_facturado_ars: number;
    let monto_facturado_ars: number;
    let porcentaje_split: number;

    if (tipo_comprobante === 'Remito') {
      monto_facturado_ars = 0;
      monto_no_facturado_ars = total_real_ars;
      porcentaje_split = 0;
    } else if (monto_interno !== undefined && monto_interno >= 0) {
      monto_no_facturado_ars = Math.min(Number(monto_interno), total_subtotal_ars);
      const neto_facturado = Math.max(0, total_subtotal_ars - monto_no_facturado_ars);
      porcentaje_split = total_subtotal_ars > 0 ? (neto_facturado / total_subtotal_ars) * 100 : 100;
      monto_facturado_ars = total_real_ars - monto_no_facturado_ars;
    } else {
      porcentaje_split = Number(client.porcentaje_facturacion ?? 100);
      monto_facturado_ars = total_real_ars * (porcentaje_split / 100);
      monto_no_facturado_ars = total_real_ars - monto_facturado_ars;
    }

    console.log(`[SaleService.create] Creando venta inicial: total_subtotal=${total_subtotal_ars}, monto_interno=${monto_interno}, split=${porcentaje_split}`);

    const initialSale = await prisma.sale.create({
      data: {
        client_id,
        total_real_ars,
        cotizacion_dolar_usada: cotizacion,
        monto_facturado_ars,
        monto_no_facturado_ars,
        porcentaje_split,
        subtotal_ars: total_subtotal_ars,
        iva_ars: total_iva_ars,
        tipo_comprobante,
        fecha_vto_pago: fecha_vto_pago ? new Date(fecha_vto_pago) : undefined,
        estado_factura: 'PENDIENTE',
        items: {
          create: saleItemsData
        }
      },
      include: {
        client: true,
        items: true
      }
    });

    // Emisión inmediata de un tirón (ARCA o REMITO)
    const billingMode = (tipo_comprobante === 'Remito') ? 'REMITO' : 'ARCA';
    try {
      const billedSale = await SaleService.processBilling(
        initialSale.id,
        billingMode,
        true, // impactBalance
        undefined, // customPrices
        cotizacion,
        Number(data.percepciones_iibb_ars || 0),
        Number(data.percepciones_iva_ars || 0),
        monto_interno
      );
      return billedSale;
    } catch (billingError: any) {
      console.error('[SaleService] Error en emisión de comprobante:', billingError);
      // Eliminar el comprobante inicial para no dejar ventas huérfanas si AFIP rechaza
      await prisma.saleItem.deleteMany({ where: { sale_id: initialSale.id } });
      await prisma.sale.delete({ where: { id: initialSale.id } });
      throw billingError;
    }
  }

  /**
   * Emite una Nota de Crédito para cancelar una Factura A o B autorizada por AFIP.
   * FIX: Soporta Factura A → NC A y Factura B → NC B.
   * FIX: Pasa correctamente los ítems con iva_importe_ars al servicio de AFIP.
   */
  static async processCreditNote(saleId: number) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { client: true, items: true } 
    });

    if (!sale) throw new AppError('Venta no encontrada', 404);
    if (!sale.cae || !['Factura A', 'Factura B'].includes(sale.tipo_comprobante)) {
      throw new AppError('Solo se pueden anular Facturas A o B autorizadas por AFIP', 400); 
    }
    if (sale.estado_factura === 'ANULADA') {
      throw new AppError('La factura ya se encuentra anulada', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const creditNoteTipo = sale.tipo_comprobante === 'Factura A' ? 'Nota de Crédito A' : 'Nota de Crédito B';
      
      // FIX: Construir payload completo con ítems e importes de IVA correctos
      // El nro_comprobante de la factura original es el que asociamos
      const nroAsociado = parseInt(sale.nro_comprobante || '0');

      const creditNotePayload = {
        ...sale,
        tipo_comprobante: creditNoteTipo,
        // comprobante_asociado: número de comprobante original (sin el punto de venta)
        comprobante_asociado: nroAsociado,
        fecha_comprobante_asociado: sale.fecha,
        // items con importes correctos para calcular el array IVA en AfipService
        items: sale.items.map(item => ({
          ...item,
          precio_unitario_ars: Number(item.precio_unitario_ars),
          iva_tasa: Number(item.iva_tasa),
          iva_importe_ars: Number(item.iva_importe_ars),
          cantidad: item.cantidad,
        })),
        subtotal_ars: sale.subtotal_ars,
        iva_ars: sale.iva_ars,
        percepciones_iibb_ars: Number(sale.percepciones_iibb_ars || 0),
        percepciones_iva_ars: Number(sale.percepciones_iva_ars || 0),
      };

      const afipResult = await AfipService.createInvoice(creditNotePayload as any);

      const currentClient = await tx.client.findUnique({ where: { id: sale.client_id } });
      if (currentClient) {
        await tx.client.update({
          where: { id: sale.client_id },
          data: {
            saldo_blanco: { increment: Number(sale.monto_facturado_ars) },
            saldo_deuda: { increment: Number(sale.monto_facturado_ars) }
          }
        });
      }

      // Buscar si existe un Remito interno (diferencial) desprendido de esta factura
      const linkedRemito = await tx.sale.findFirst({
        where: {
          client_id: sale.client_id,
          tipo_comprobante: 'Remito',
          estado_factura: 'FACTURADO',
          OR: [
            { nro_comprobante: `REM-${saleId}` },
            { nro_comprobante: `DIF-${saleId}` },
            {
              items: {
                some: {
                  descripcion: `Diferencial de Factura #${String(saleId).padStart(5, '0')}`
                }
              }
            }
          ]
        }
      });

      if (linkedRemito) {
        // Anular el remito asociado
        await tx.sale.update({
          where: { id: linkedRemito.id },
          data: { estado_factura: 'ANULADA' }
        });

        // Restaurar el saldo interno y sumar a la cancelación de la deuda
        if (currentClient) {
          await tx.client.update({
            where: { id: sale.client_id },
            data: {
              saldo_interno: { increment: Number(linkedRemito.total_real_ars) },
              saldo_deuda: { increment: Number(linkedRemito.total_real_ars) }
            }
          });
        }
      }

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          estado_factura: 'ANULADA',
          cae_nota_credito: afipResult.cae,
          nro_comprobante_nc: afipResult.nro_comprobante,
          fecha_nota_credito: new Date(), // Fecha real de emisión de la NC
        },
        include: { client: true, items: true }
      });

      return updatedSale;
    });
  }

  static async getAll(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    const [total, sales] = await Promise.all([
      prisma.sale.count(),
      prisma.sale.findMany({
        skip,
        take: limit,
        include: { 
          client: true,
          items: true
        },
        orderBy: { fecha: 'desc' }
      })
    ]);

    return {
      data: sales,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getById(id: number) {
    return await prisma.sale.findUnique({
      where: { id },
      include: { client: true, items: true }
    });
  }
}
