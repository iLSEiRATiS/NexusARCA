import { z } from 'zod';
import { CondicionIva } from '@prisma/client';

export const createClientSchema = z.object({
  body: z.object({
    razon_social: z.string({ required_error: 'La razon social es requerida' }).min(3, 'La razon social debe tener al menos 3 caracteres'),
    cuit: z.string({ required_error: 'El CUIT es requerido' }).min(11, 'CUIT invalido').max(13),
    direccion: z.string().optional(),
    condicion_iva: z.nativeEnum(CondicionIva).optional(),
    nro_iibb: z.string().optional(),
    telefono: z.string().optional(),
    porcentaje_facturacion: z.number().min(0).max(100).optional(),
  })
});

export const updateClientSchema = z.object({
  body: z.object({
    razon_social: z.string().min(3).optional(),
    cuit: z.string().min(11).max(13).optional(),
    direccion: z.string().optional(),
    condicion_iva: z.nativeEnum(CondicionIva).optional(),
    nro_iibb: z.string().optional(),
    telefono: z.string().optional(),
    porcentaje_facturacion: z.number().min(0).max(100).optional(),
    saldo_deuda: z.number().optional(),
  })
});
