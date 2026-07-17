import { z } from 'zod';

export const createQuotationSchema = z.object({
  body: z.object({
    client_id: z.number({ required_error: 'El ID del cliente es requerido' }),
    items: z.array(
      z.object({
        descripcion: z.string({ required_error: 'La descripción es requerida' }),
        cantidad: z.number({ required_error: 'La cantidad es requerida' }).positive(),
        precio_unitario_usd: z.number({ required_error: 'El precio es requerido' }).nonnegative(),
        iva_tasa: z.number({ required_error: 'La tasa de IVA es requerida' }).nonnegative()
      })
    ).min(1, 'La cotización debe tener al menos un producto'),
    validez_dias: z.number().int().positive().optional().default(15),
  })
});

export const updateQuotationStatusSchema = z.object({
  body: z.object({
    estado: z.enum(['PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CONVERTIDO'], {
      required_error: 'El estado es requerido'
    })
  })
});
