import prisma from '../config/prisma';
import { CurrencyService } from './currency.service';
import { AfipService } from './afip.service';
import { AppError } from '../utils/AppError';

export class SaleService {
  /**
   * Procesa la facturación de una venta ya creada (PENDIENTE → FACTURADO o REMITO).
   * Si el usuario ajustó los precios a la baja, genera automáticamente un Remito
   * por la diferencia entre el total original y el total facturado.
   */
  static async processBilling(
    saleId: number, 
    mode: 'ARCA' | 'REMITO' = 'ARCA', 
    impactBalance: boolean = true,
    customPrices?: Record<number, { price: number, currency: 'USD' | 'ARS' }>,
    cotizacion_usada: number = 1000,
    percepciones_iibb_ars: number = 0,
    percepciones_iva_ars: number = 0
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { client: true, items: true }
    });

    if (!sale) throw new AppError('Venta no encontrada', 404);
    if (mode === 'ARCA' && sale.cae) throw new AppError('La venta ya posee CAE asignado', 400);

    return await prisma.$transaction(async (tx) => {
      // Calcular total con precios AJUSTADOS (lo que va a ARCA)
      let total_real_ars = 0;
      let subtotal_ars = 0;
      let iva_ars = 0;

      // Calcular total ORIGINAL (precios sin ajustar) para detectar diferencial
      let total_original_ars = 0;

      for (const item of sale.items) {
        const precio_original_ars = Number(item.precio_unitario_ars);
        const subtotal_original = precio_original_ars * item.cantidad;
        const iva_original = subtotal_original * (Number(item.iva_tasa) / 100);
        total_original_ars += (subtotal_original + iva_original);

        let precio_unitario_ars = precio_original_ars;
        let precio_unitario_usd = Number(item.precio_unitario_usd);

        if (customPrices && customPrices[item.id]) {
          const config = customPrices[item.id];
          if (config.currency === 'USD') {
            precio_unitario_usd = config.price;
            precio_unitario_ars = precio_unitario_usd * cotizacion_usada;
          } else {
            precio_unitario_ars = config.price;
            precio_unitario_usd = precio_unitario_ars / cotizacion_usada;
          }
        }

        const subtotal_item = precio_unitario_ars * item.cantidad;
        const iva_item = subtotal_item * (Number(item.iva_tasa) / 100);

        total_real_ars += (subtotal_item + iva_item);
        subtotal_ars += subtotal_item;
        iva_ars += iva_item;

        // Guardar iva_importe_ars en el item para usarlo en AfipService
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
        
        updateData = {
          ...updateData,
          cae: afipResult.cae,
          vto_cae: new Date(afipResult.vto_cae),
          nro_comprobante: afipResult.nro_comprobante,
          estado_factura: 'FACTURADO',
          tipo_comprobante: tipoComprobante,
          monto_facturado_ars: total_real_ars,
          monto_no_facturado_ars: 0,
          porcentaje_split: 100
        };

        // ── SPLIT AUTOMÁTICO: Crear Remito por el diferencial ──────────
        const diferencial = total_original_ars - total_real_ars;
        if (diferencial > 1) { // Umbral de $1 para evitar errores de redondeo
          console.log(`[SaleService] Diferencial detectado: $${diferencial.toFixed(2)} → Creando Remito automático`);
          
          await tx.sale.create({
            data: {
              client_id: sale.client_id,
              total_real_ars: diferencial,
              cotizacion_dolar_usada: cotizacion_usada,
              monto_facturado_ars: 0,
              monto_no_facturado_ars: diferencial,
              porcentaje_split: 0,
              subtotal_ars: diferencial,
              iva_ars: 0,
              tipo_comprobante: 'Remito',
              estado_factura: 'PENDIENTE',
              fecha_vto_pago: sale.fecha_vto_pago,
              items: {
                create: [{
                  descripcion: `Diferencial de Factura #${String(saleId).padStart(5, '0')}`,
                  cantidad: 1,
                  precio_unitario_ars: diferencial,
                  precio_unitario_usd: diferencial / cotizacion_usada,
                  iva_tasa: 0,
                  iva_importe_ars: 0
                }]
              }
            }
          });

          // Impactar saldo negro por el diferencial
          if (impactBalance) {
            await tx.client.update({
              where: { id: sale.client_id },
              data: {
                saldo_negro: { decrement: diferencial }
              }
            });
          }
        }
      } else {
        // Modo REMITO: todo va sin facturar
        updateData = {
          ...updateData,
          tipo_comprobante: 'Remito',
          estado_factura: 'PENDIENTE',
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
        await tx.client.update({
          where: { id: updatedSale.client_id },
          data: {
            saldo_blanco: mode === 'ARCA' ? { decrement: total_real_ars } : undefined,
            saldo_negro: mode === 'REMITO' ? { decrement: total_real_ars } : undefined,
            saldo_deuda: { decrement: total_real_ars }
          }
        });
      }

      return updatedSale;
    });
  }

  /**
   * Crea una venta nueva en estado PENDIENTE con sus ítems.
   */
  static async create(data: {
    client_id?: number;
    cuit?: string;
    items: { descripcion: string; cantidad: number; precio_unitario_usd: number; iva_tasa: number }[];
    tipo_comprobante: string;
    fecha_vto_pago?: string;
  }) {
    const { items, tipo_comprobante, fecha_vto_pago } = data;
    const cotizacion = await CurrencyService.getDolarOficial();
    
    let client;
    if (data.client_id) {
      client = await prisma.client.findUnique({ where: { id: data.client_id } });
    } else if (data.cuit) {
      client = await prisma.client.findUnique({ where: { cuit: data.cuit } });
    }
    
    if (!client) {
      throw new AppError(
        'El CUIT ingresado no corresponde a ningún cliente registrado. Cargue el cliente primero desde la sección de Clientes con su Razón Social y Condición IVA correctos.',
        404
      );
    }

    const client_id = client.id;
    const porcentaje_split = tipo_comprobante === 'Factura A' || tipo_comprobante === 'Factura B' ? 100 : 0;

    return await prisma.$transaction(async (tx) => {
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

      const monto_facturado_ars = total_real_ars * (porcentaje_split / 100);
      const monto_no_facturado_ars = total_real_ars - monto_facturado_ars;
      const ratio_facturado = porcentaje_split / 100;
      const subtotal_ars = total_subtotal_ars * ratio_facturado;
      const iva_ars = total_iva_ars * ratio_facturado;

      const sale = await tx.sale.create({
        data: {
          client_id,
          total_real_ars,
          cotizacion_dolar_usada: cotizacion,
          monto_facturado_ars,
          monto_no_facturado_ars,
          porcentaje_split,
          subtotal_ars,
          iva_ars,
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

      const currentClient = await tx.client.findUnique({ where: { id: client_id } });
      if (currentClient) {
        const newSaldoBlanco = Number(currentClient.saldo_blanco) - monto_facturado_ars;
        const newSaldoNegro = Number(currentClient.saldo_negro) - monto_no_facturado_ars;
        
        await tx.client.update({
          where: { id: client_id },
          data: { 
            saldo_blanco: newSaldoBlanco,
            saldo_negro: newSaldoNegro,
            saldo_deuda: newSaldoBlanco + newSaldoNegro
          }
        });
      }

      return sale;
    });
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

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          estado_factura: 'ANULADA',
          cae_nota_credito: afipResult.cae,
          nro_comprobante_nc: afipResult.nro_comprobante,
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
