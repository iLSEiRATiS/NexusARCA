import { z } from 'zod';

export const createSaleSchema = z.object({
  body: z.object({
    client_id: z.number().optional(),
    cuit: z.string().optional(),
    items: z.array(
      z.object({
        product_id: z.number({ required_error: 'El ID del producto es requerido' }),
        cantidad: z.number({ required_error: 'La cantidad es requerida' }).int().positive(),
      })
    ).min(1, 'La venta debe tener al menos un producto'),
    tipo_comprobante: z.string().default('Factura A'),
  }).refine(data => data.client_id || data.cuit, {
    message: "Debe proporcionar client_id o cuit"
  })
});
