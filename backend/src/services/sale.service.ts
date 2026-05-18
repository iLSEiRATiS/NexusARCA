import prisma from '../config/prisma';
import { CurrencyService } from './currency.service';
import { AppError } from '../utils/AppError';
import { MovementType } from '@prisma/client';

export class SaleService {
  static async create(data: {
    client_id: number;
    items: { product_id: number; cantidad: number; batch_id?: number }[];
    tipo_comprobante: string;
    porcentaje_split_override?: number;
  }) {
    const { client_id, items, tipo_comprobante, porcentaje_split_override } = data;

    // 1. Obtener cotización del dólar y datos del cliente
    const cotizacion = await CurrencyService.getDolarOficial();
    const client = await prisma.client.findUnique({ where: { id: client_id } });
    if (!client) throw new AppError('Cliente no encontrado', 404);

    const porcentaje_split = porcentaje_split_override ?? Number(client.porcentaje_facturacion);

    return await prisma.$transaction(async (tx) => {
      let total_real_ars = 0;
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
        
        const subtotal_item = precioUnitarioBultoArs * item.cantidad;
        total_real_ars += subtotal_item;

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

      const tasa_iva_promedio = 1.21; 
      const subtotal_ars = monto_facturado_ars / tasa_iva_promedio;
      const iva_ars = monto_facturado_ars - subtotal_ars;

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
