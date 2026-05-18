import { z } from 'zod';

export const createSaleSchema = z.object({
  body: z.object({
    client_id: z.number({ required_error: 'El ID del cliente es requerido' }),
    items: z.array(
      z.object({
        product_id: z.number({ required_error: 'El ID del producto es requerido' }),
        cantidad: z.number({ required_error: 'La cantidad es requerida' }).int().positive(),
      })
    ).min(1, 'La venta debe tener al menos un producto'),
    tipo_comprobante: z.string().default('Factura B'),
    porcentaje_split_override: z.number().min(0).max(100).optional(), // Por si se quiere cambiar el % solo para esta venta
  })
});
