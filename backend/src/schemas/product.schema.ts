import { z } from 'zod';
import { MovementType } from '@prisma/client';

export const createProductSchema = z.object({
  body: z.object({
    nombre: z.string({ required_error: 'El nombre es requerido' }).min(2, 'El nombre debe tener al menos 2 caracteres'),
    presentacion: z.string().optional(),
    precio_usd: z.number({ required_error: 'El precio en USD es requerido' }).positive('El precio debe ser positivo'),
    iva_tasa: z.number().nonnegative().optional(),
    stock_actual: z.number().int().nonnegative('El stock no puede ser negativo').optional(),
    stock_minimo: z.number().int().nonnegative('El stock mínimo no puede ser negativo').optional(),
  })
});

export const updateProductSchema = z.object({
  body: z.object({
    nombre: z.string().min(2).optional(),
    presentacion: z.string().optional(),
    precio_usd: z.number().positive().optional(),
    iva_tasa: z.number().nonnegative().optional(),
    stock_actual: z.number().int().nonnegative().optional(),
    stock_minimo: z.number().int().nonnegative().optional(),
  })
});

export const adjustStockSchema = z.object({
  body: z.object({
    cantidad: z.number({ required_error: 'La cantidad es requerida' }).int().positive('La cantidad debe ser mayor a 0'),
    tipo: z.nativeEnum(MovementType, { required_error: 'El tipo de movimiento es requerido (INGRESO, EGRESO, AJUSTE)' }),
    motivo: z.string({ required_error: 'El motivo es requerido' }).min(3, 'Motivo demasiado corto'),
  })
});
