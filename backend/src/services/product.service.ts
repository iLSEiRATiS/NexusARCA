import prisma from '../config/prisma';
import { MovementType } from '@prisma/client';

export class ProductService {
  static async getAll() {
    return await prisma.product.findMany({
      include: { 
        movements: { take: 5, orderBy: { fecha: 'desc' } },
        batches: true // Quitamos el filtro gt: 0 para que siempre se vean en gestión
      }
    });
  }

  static async getById(id: number) {
    return await prisma.product.findUnique({
      where: { id },
      include: { 
        batches: { orderBy: { createdAt: 'desc' } },
        movements: { orderBy: { fecha: 'desc' } } 
      }
    });
  }

  static async create(data: { 
    nombre: string; 
    presentacion?: string; 
    peso_kg?: number;
    costo_usd?: number;
    precio_usd: number; 
    iva_tasa?: number;
    stock_actual?: number; 
    stock_minimo?: number 
  }) {
    const { stock_actual = 0, ...rest } = data;

    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...rest, stock_actual }
      });

      if (stock_actual > 0) {
        await tx.stockMovement.create({
          data: {
            product_id: product.id,
            cantidad: stock_actual,
            tipo: MovementType.INGRESO,
            motivo: 'Stock inicial'
          }
        });
      }

      return product;
    });
  }

  static async update(id: number, data: any) {
    return await prisma.product.update({
      where: { id },
      data
    });
  }

  static async delete(id: number) {
    return await prisma.product.delete({ where: { id } });
  }

  static async adjustStock(productId: number, cantidad: number, tipo: MovementType, motivo: string, nroLote?: string, fechaVencimiento?: Date) {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Producto no encontrado');

      // Lógica de lotes para INGRESO
      if (tipo === MovementType.INGRESO && nroLote) {
        const batch = await tx.batch.findFirst({ where: { product_id: productId, nro_lote: nroLote } });
        if (batch) {
          await tx.batch.update({ where: { id: batch.id }, data: { cantidad_bultos: { increment: cantidad } } });
        } else {
          await tx.batch.create({
            data: {
              product_id: productId,
              nro_lote: nroLote,
              cantidad_bultos: cantidad,
              fecha_vencimiento: fechaVencimiento
            }
          });
        }
      }

      const stockActual = product.stock_actual;
      const nuevoStock = tipo === MovementType.INGRESO 
        ? stockActual + cantidad 
        : stockActual - cantidad;

      if (nuevoStock < 0) throw new Error('Stock insuficiente para realizar el egreso');

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock_actual: nuevoStock }
      });

      await tx.stockMovement.create({
        data: {
          product_id: productId,
          cantidad,
          tipo,
          motivo: nroLote ? `${motivo} (Lote: ${nroLote})` : motivo
        }
      });

      return updatedProduct;
    });
  }

  static async deleteBatch(batchId: number) {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id: batchId } });
      if (!batch) throw new Error('Lote no encontrado');

      // Restar la cantidad de este lote del stock total del producto
      await tx.product.update({
        where: { id: batch.product_id },
        data: { stock_actual: { decrement: batch.cantidad_bultos } }
      });

      return await tx.batch.delete({ where: { id: batchId } });
    });
  }

  static async getAlerts() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [lowStock, expiringBatches] = await Promise.all([
      // Productos por debajo o igual al stock mínimo
      prisma.product.findMany({
        where: {
          stock_actual: {
            lte: prisma.product.fields.stock_minimo
          }
        }
      }),
      // Lotes que vencen en los próximos 30 días o ya vencieron
      prisma.batch.findMany({
        where: {
          fecha_vencimiento: {
            lte: thirtyDaysFromNow
          },
          cantidad_bultos: {
            gt: 0
          }
        },
        include: {
          product: true
        },
        orderBy: {
          fecha_vencimiento: 'asc'
        }
      })
    ]);

    return { lowStock, expiringBatches };
  }

  static async updateBatch(batchId: number, data: { nro_lote?: string, cantidad_bultos?: number, fecha_vencimiento?: string, estado?: string }) {
    return await prisma.$transaction(async (tx) => {
      const oldBatch = await tx.batch.findUnique({ where: { id: batchId } });
      if (!oldBatch) throw new Error('Lote no encontrado');

      const updatedBatch = await tx.batch.update({
        where: { id: batchId },
        data: {
          ...data,
          fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : undefined
        }
      });

      // Si cambió la cantidad de bultos, actualizar el stock total del producto
      if (data.cantidad_bultos !== undefined) {
        const diff = data.cantidad_bultos - oldBatch.cantidad_bultos;
        await tx.product.update({
          where: { id: oldBatch.product_id },
          data: { stock_actual: { increment: diff } }
        });
      }

      return updatedBatch;
    });
  }
}
