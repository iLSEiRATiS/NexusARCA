import prisma from '../config/prisma';
import { CurrencyService } from './currency.service';
import { AppError } from '../utils/AppError';
import { SaleService } from './sale.service';

export class QuotationService {
  static async create(data: {
    client_id: number;
    items: { descripcion: string; cantidad: number; precio_unitario_usd: number; iva_tasa: number }[];
    validez_dias?: number;
  }) {
    const { client_id, items, validez_dias } = data;

    const cotizacion = await CurrencyService.getDolarOficial();
    const client = await prisma.client.findUnique({ where: { id: client_id } });
    if (!client) throw new AppError('Cliente no encontrado', 404);

    return await prisma.$transaction(async (tx) => {
      let total_real_ars = 0;
      const quotationItemsData = [];

      for (const item of items) {
        const precioUnitarioArs = item.precio_unitario_usd * cotizacion;
        const subtotal_item = precioUnitarioArs * item.cantidad;
        const iva_item = subtotal_item * (item.iva_tasa / 100);
        
        total_real_ars += (subtotal_item + iva_item);

        quotationItemsData.push({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario_ars: precioUnitarioArs, 
          precio_unitario_usd: item.precio_unitario_usd,
          iva_tasa: item.iva_tasa
        });
      }

      const quotation = await tx.quotation.create({
        data: {
          client_id,
          total_real_ars,
          cotizacion_dolar_usada: cotizacion,
          validez_dias: validez_dias ?? 15,
          items: {
            create: quotationItemsData
          }
        },
        include: {
          client: true,
          items: true
        }
      });

      return quotation;
    });
  }

  static async getAll(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    const [total, quotations] = await Promise.all([
      prisma.quotation.count(),
      prisma.quotation.findMany({
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
      data: quotations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getById(id: number) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { client: true, items: true }
    });
    if (!quotation) throw new AppError('Cotización no encontrada', 404);
    return quotation;
  }

  static async updateStatus(id: number, estado: string) {
    return await prisma.quotation.update({
      where: { id },
      data: { estado }
    });
  }

  static async delete(id: number) {
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) throw new AppError('Cotización no encontrada', 404);
    
    return await prisma.quotation.delete({
      where: { id }
    });
  }

  static async convertToSale(id: number, data: { tipo_comprobante: string }) {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!quotation) throw new AppError('Cotización no encontrada', 404);
    if (quotation.estado === 'CONVERTIDO') throw new AppError('La cotización ya ha sido convertida en venta', 400);

    const sale = await SaleService.create({
      client_id: quotation.client_id,
      items: quotation.items.map(item => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario_usd: Number(item.precio_unitario_usd),
        iva_tasa: Number(item.iva_tasa)
      })),
      tipo_comprobante: data.tipo_comprobante
    });

    await prisma.quotation.update({
      where: { id },
      data: { estado: 'CONVERTIDO' }
    });

    return sale;
  }
}
