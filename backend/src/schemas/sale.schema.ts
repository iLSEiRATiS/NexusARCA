import { z } from 'zod';

export const createSaleSchema = z.object({
  body: z.object({
    client_id: z.number().optional(),
    cuit: z.string().optional(),
    items: z.array(
      z.object({
        descripcion: z.string({ required_error: 'La descripción es requerida' }),
        cantidad: z.number({ required_error: 'La cantidad es requerida' }).positive(),
        precio_unitario_usd: z.number({ required_error: 'El precio es requerido' }).nonnegative(),
        iva_tasa: z.number({ required_error: 'La tasa de IVA es requerida' }).nonnegative()
      })
    ).min(1, 'La venta debe tener al menos un producto'),
    tipo_comprobante: z.string().default('Factura A'),
  }).refine(data => data.client_id || data.cuit, {
    message: "Debe proporcionar client_id o cuit"
  })
});
