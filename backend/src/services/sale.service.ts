import prisma from '../config/prisma';
import { CurrencyService } from './currency.service';
import { AfipService } from './afip.service';
import { AppError } from '../utils/AppError';
import { MovementType } from '@prisma/client';

export class SaleService {
  /**
   * Procesa la facturación oficial ante AFIP o convierte a Presupuesto (Negro).
   * @param saleId ID de la venta local
   * @param mode 'ARCA' para factura oficial, 'PRESUPUESTO' para informal
   * @param impactBalance Si debe afectar la deuda del cliente
   * @param customPrices Precios manuales por ítem { id: { price: number, currency: 'USD'|'ARS' } }
   * @param cotizacion_usada Cotización BNA al momento de procesar
   */
  static async processBilling(
    saleId: number, 
    mode: 'ARCA' | 'PRESUPUESTO' = 'ARCA', 
    impactBalance: boolean = true,
    customPrices?: Record<number, { price: number, currency: 'USD' | 'ARS' }>,
    cotizacion_usada: number = 1000
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { client: true, items: { include: { product: true } } }
    });

    if (!sale) throw new AppError('Venta no encontrada', 404);
    if (mode === 'ARCA' && sale.cae) throw new AppError('La venta ya posee CAE asignado', 400);

    return await prisma.$transaction(async (tx) => {
      let total_real_ars = 0;
      let subtotal_ars = 0;
      let iva_ars = 0;

      // 1. Recalcular precios si se enviaron ajustes manuales
      for (const item of sale.items) {
        let precio_unitario_ars = Number(item.precio_unitario_ars);
        let precio_unitario_usd = Number(item.precio_unitario_usd);

        if (customPrices && customPrices[item.id]) {
          const config = customPrices[item.id];
          if (config.currency === 'USD') {
            precio_unitario_usd = config.price;
            // USD se multiplica por cotización y por peso_kg del producto para llegar al bulto en ARS
            precio_unitario_ars = precio_unitario_usd * cotizacion_usada * Number(item.product.peso_kg);
          } else {
            precio_unitario_ars = config.price;
            precio_unitario_usd = 0; // Se cargó directamente en pesos
          }
        }

        const subtotal_item = precio_unitario_ars * item.cantidad;
        const iva_item = subtotal_item * (Number(item.iva_tasa) / 100);

        total_real_ars += (subtotal_item + iva_item);
        subtotal_ars += subtotal_item;
        iva_ars += iva_item;

        // Actualizar el ítem con el precio final usado
        await tx.saleItem.update({
          where: { id: item.id },
          data: {
            precio_unitario_ars,
            precio_unitario_usd
          }
        });
      }

      let updateData: any = {
        total_real_ars,
        subtotal_ars,
        iva_ars,
        cotizacion_dolar_usada: cotizacion_usada
      };

      if (mode === 'ARCA') {
        // 2. Solicitar CAE a AFIP con los nuevos totales
        // Mock de datos para el servicio de AFIP (necesita el objeto sale actualizado)
        const saleForAfip = { ...sale, monto_facturado_ars: total_real_ars, subtotal_ars, iva_ars };
        const afipResult = await AfipService.createInvoice(saleForAfip);
        
        updateData = {
          ...updateData,
          cae: afipResult.cae,
          vto_cae: new Date(afipResult.vto_cae),
          nro_comprobante: afipResult.nro_comprobante,
          estado_factura: 'FACTURADO',
          tipo_comprobante: sale.client.condicion_iva === 'RESPONSABLE_INSCRIPTO' ? 'Factura A' : 'Factura B',
          monto_facturado_ars: total_real_ars,
          monto_no_facturado_ars: 0,
          porcentaje_split: 100
        };
      } else {
        // 3. Modo Presupuesto (Negro)
        updateData = {
          ...updateData,
          tipo_comprobante: 'Presupuesto',
          estado_factura: 'PENDIENTE',
          monto_facturado_ars: 0,
          monto_no_facturado_ars: total_real_ars,
          porcentaje_split: 0
        };
      }

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: updateData,
        include: { client: true }
      });

      // 4. Impactar en Cuenta Corriente si se solicitó
      if (impactBalance) {
        await tx.client.update({
          where: { id: updatedSale.client_id },
          data: {
            saldo_blanco: mode === 'ARCA' ? { decrement: total_real_ars } : undefined,
            saldo_negro: mode === 'PRESUPUESTO' ? { decrement: total_real_ars } : undefined,
            saldo_deuda: { decrement: total_real_ars }
          }
        });
      }

      return updatedSale;
    });
  }

  static async create(data: {
    client_id?: number;
    cuit?: string;
    items: { product_id: number; cantidad: number; batch_id?: number }[];
    tipo_comprobante: string;
  }) {
    const { items, tipo_comprobante } = data;

    // 1. Obtener cotización del dólar y datos del cliente
    const cotizacion = await CurrencyService.getDolarOficial();
    
    let client;
    if (data.client_id) {
      client = await prisma.client.findUnique({ where: { id: data.client_id } });
    } else if (data.cuit) {
      client = await prisma.client.findUnique({ where: { cuit: data.cuit } });
      if (!client) {
        // Crear cliente nuevo si no existe
        client = await prisma.client.create({
          data: {
            cuit: data.cuit,
            razon_social: 'CONSUMIDOR (CREADO AUT.)',
            condicion_iva: 'RESPONSABLE_INSCRIPTO'
          }
        });
      }
    }
    
    if (!client) throw new AppError('Cliente no encontrado ni creado', 404);

    const client_id = client.id;
    // Eliminamos la lógica del split. Factura A = 100% blanco. Presupuesto = 100% negro.
    const porcentaje_split = tipo_comprobante === 'Factura A' ? 100 : 0;

    return await prisma.$transaction(async (tx) => {
      let total_real_ars = 0;
      let total_subtotal_ars = 0;
      let total_iva_ars = 0;
      const saleItemsData = [];

      // 2. Procesar ítems y calcular totales reales
      for (const item of items) {
        const product = await tx.product.findUnique({ 
          where: { id: item.product_id },
          include: { batches: true }
        });
        if (!product) throw new AppError(`Producto ID ${item.product_id} no encontrado`, 404);
        
        if (product.stock_actual < item.cantidad) {
          throw new AppError(`Stock insuficiente para ${product.nombre}`, 400);
        }

        // Si se especificó un lote, validar stock del lote
        if (item.batch_id) {
          const batch = await tx.batch.findUnique({ where: { id: item.batch_id } });
          if (!batch || batch.cantidad_bultos < item.cantidad) {
            throw new AppError(`Stock insuficiente en el lote especificado para ${product.nombre}`, 400);
          }
          // Descontar del lote
          await tx.batch.update({
            where: { id: item.batch_id },
            data: { cantidad_bultos: { decrement: item.cantidad } }
          });
        }

        const pesoKgPorUnidad = Number(product.peso_kg);
        const precioUsdPorKg = Number(product.precio_usd);
        const precioUnitarioBultoArs = (precioUsdPorKg * cotizacion) * pesoKgPorUnidad;
        
        const neto_item = precioUnitarioBultoArs * item.cantidad;
        const iva_item = neto_item * (Number(product.iva_tasa) / 100);
        total_real_ars += (neto_item + iva_item);
        total_subtotal_ars += neto_item;
        total_iva_ars += iva_item;

        saleItemsData.push({
          product_id: product.id,
          batch_id: item.batch_id,
          cantidad: item.cantidad,
          precio_unitario_ars: (precioUsdPorKg * cotizacion), 
          precio_unitario_usd: product.precio_usd, 
          iva_tasa: product.iva_tasa
        });

        // Descontar stock general del producto
        await tx.product.update({
          where: { id: product.id },
          data: { stock_actual: { decrement: item.cantidad } }
        });

        // Registrar movimiento
        await tx.stockMovement.create({
          data: {
            product_id: product.id,
            cantidad: item.cantidad,
            tipo: MovementType.EGRESO,
            motivo: `Venta al cliente ${client.razon_social}${item.batch_id ? ' (Salida de lote)' : ''}`
          }
        });
      }

      // 3. Lógica de Split (Blanco / Negro)
      const monto_facturado_ars = total_real_ars * (porcentaje_split / 100);
      const monto_no_facturado_ars = total_real_ars - monto_facturado_ars;

      // IVA calculado correctamente por ítem (no tasa fija promedio)
      const ratio_facturado = porcentaje_split / 100;
      const subtotal_ars = total_subtotal_ars * ratio_facturado;
      const iva_ars = total_iva_ars * ratio_facturado;

      // 4. Crear la venta
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
          estado_factura: 'PENDIENTE',
          items: {
            create: saleItemsData
          }
        },
        include: {
          client: true,
          items: {
            include: { product: true }
          }
        }
      });

      // 5. Actualizar saldos del cliente (Aumentar deuda negativa)
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

  static async processCreditNote(saleId: number) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { client: true }
    });

    if (!sale) throw new AppError('Venta no encontrada', 404);
    if (!sale.cae || sale.tipo_comprobante !== 'Factura A') {
      throw new AppError('Solo se pueden anular Facturas A autorizadas por AFIP', 400);
    }
    if (sale.estado_factura === 'ANULADA') {
      throw new AppError('La factura ya se encuentra anulada', 400);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Crear el payload para Nota de Crédito A (CbteTipo 3)
      const creditNotePayload = {
        ...sale,
        tipo_comprobante: 'Nota de Crédito A',
        comprobante_asociado: sale.nro_comprobante // Campo que lee afip.service.ts
      };

      // 2. Solicitar CAE para la Nota de Crédito
      const afipResult = await AfipService.createInvoice(creditNotePayload);

      // 3. Revertir saldo en la cuenta corriente del cliente (se aumenta el saldo porque se cancela la deuda)
      const currentClient = await tx.client.findUnique({ where: { id: sale.client_id } });
      if (currentClient) {
        await tx.client.update({
          where: { id: sale.client_id },
          data: {
            saldo_blanco: { increment: sale.monto_facturado_ars },
            saldo_deuda: { increment: sale.monto_facturado_ars }
          }
        });
      }

      // 4. Marcar la factura original como anulada y guardar el CAE de la nota de crédito
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          estado_factura: 'ANULADA',
          // Guardamos el CAE de la nota de crédito como referencia (opcionalmente podríamos crear un modelo CreditNote)
          cae: `NC:${afipResult.cae}`, 
        },
        include: { client: true }
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
          items: {
            include: { product: true }
          }
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
      include: { client: true, items: { include: { product: true } } }
    });
  }
}
