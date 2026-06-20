import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

export class ImportController {
  /**
   * Importa una salida de stock desde el CSV simplificado.
   * Formato: ID_SALIDA;FECHA;DESTINO;PRODUCTO_ID;PRODUCTO_NOMBRE;CANTIDAD;LOTE
   */
  static importSaleCSV = asyncHandler(async (req: Request, res: Response) => {
    const { csvData } = req.body;

    if (!csvData) {
      throw new AppError('No se proporcionaron datos CSV', 400);
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new AppError('El CSV está vacío o no tiene el formato correcto', 400);
    }

    const rows = lines.slice(1);
    const results = [];
    const salesToProcess: Record<string, any> = {};

    for (const row of rows) {
      const columns = row.split(';');
      if (columns.length < 6) continue;

      const [external_id, fecha, destino, product_id, product_nombre, cantidad, lote] = columns;

      if (!salesToProcess[external_id]) {
        salesToProcess[external_id] = {
          external_id: parseInt(external_id),
          fecha: new Date(fecha),
          destino,
          items: []
        };
      }

      salesToProcess[external_id].items.push({
        product_id: parseInt(product_id),
        product_nombre,
        cantidad: parseInt(cantidad),
        lote
      });
    }

    // Obtener cotización actual para los cálculos
    const settings = await prisma.settings.findFirst();
    const cotizacion = Number(settings?.cotizacion_dolar_actual || 1000);

    for (const extId in salesToProcess) {
      const data = salesToProcess[extId];

      const existing = await prisma.sale.findUnique({ where: { external_id: data.external_id } });
      if (existing) {
        results.push({ external_id: data.external_id, status: 'SKIPPED' });
        continue;
      }

      // Buscar cliente por nombre (destino) o usar uno genérico
      let client = await prisma.client.findFirst({
        where: { razon_social: { contains: data.destino } }
      });

      if (!client) {
        // Si no existe, lo creamos con datos mínimos o lo asignamos a "CONSUMIDOR FINAL"
        client = await prisma.client.findFirst({ where: { cuit: '0' } }); 
        if (!client) {
          client = await prisma.client.create({
            data: {
              razon_social: data.destino,
              cuit: '0', // CUIT genérico para importaciones sin identificar
              condicion_iva: 'CONSUMIDOR_FINAL'
            }
          });
        }
      }

      let total_real_ars = 0;
      const saleItems = [];

      for (const item of data.items) {
        // Buscar el producto localmente para obtener el PRECIO REAL
        const product = await prisma.product.findUnique({ where: { id: item.product_id } });
        const precio_usd = Number(product?.precio_usd || 0);
        const peso_kg = Number(product?.peso_kg || 1);
        const precio_unitario_ars = precio_usd * cotizacion * peso_kg;
        const iva_tasa = Number(product?.iva_tasa || 21);

        total_real_ars += precio_unitario_ars * item.cantidad * (1 + iva_tasa / 100);

        saleItems.push({
          product_id: item.product_id,
          cantidad: item.cantidad,
          precio_unitario_ars,
          iva_tasa,
          precio_unitario_usd: precio_usd
        });
      }

      // Por defecto las importaciones son "Presupuesto" hasta que el usuario decida facturar
      await prisma.sale.create({
        data: {
          external_id: data.external_id,
          client_id: client.id,
          fecha: data.fecha,
          total_real_ars,
          cotizacion_dolar_usada: cotizacion,
          monto_facturado_ars: 0,
          monto_no_facturado_ars: total_real_ars,
          porcentaje_split: 0,
          subtotal_ars: total_real_ars / 1.21,
          iva_ars: total_real_ars - (total_real_ars / 1.21),
          tipo_comprobante: 'Presupuesto',
          estado_factura: 'PENDIENTE',
          items: { create: saleItems }
        }
      });

      results.push({ external_id: data.external_id, status: 'IMPORTED', client: client.razon_social });
    }

    res.json({ results });
  });
}
