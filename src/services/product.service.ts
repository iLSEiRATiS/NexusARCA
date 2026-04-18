import prisma from '../config/prisma';
import { MovementType } from '@prisma/client';

export class ProductService {
  static async getAll() {
    return await prisma.product.findMany({
      include: { movements: { take: 5, orderBy: { fecha: 'desc' } } }
    });
  }

  static async getById(id: number) {
    return await prisma.product.findUnique({
      where: { id },
      include: { movements: { orderBy: { fecha: 'desc' } } }
    });
  }

  static async create(data: { nombre: string; precio_usd: number; stock_actual?: number; stock_minimo?: number }) {
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

  static async adjustStock(productId: number, cantidad: number, tipo: MovementType, motivo: string) {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Producto no encontrado');

      const nuevoStock = tipo === MovementType.INGRESO 
        ? product.stock_actual + cantidad 
        : product.stock_actual - cantidad;

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
          motivo
        }
      });

      return updatedProduct;
    });
  }
}
