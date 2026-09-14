import { z } from 'zod';
import { CondicionIva } from '@prisma/client';

export const createClientSchema = z.object({
  body: z.object({
    razon_social: z.string({ required_error: 'La razón social es requerida' }).min(3, 'La razón social debe tener al menos 3 caracteres'),
    cuit: z.string({ required_error: 'El CUIT o documento es requerido' })
      .transform((val) => val.replace(/[-\s.]/g, ''))
      .refine((val) => val.length >= 1 && val.length <= 11, 'El CUIT o documento debe tener entre 1 y 11 dígitos'),
    email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
    direccion: z.string().optional().nullable(),
    condicion_iva: z.nativeEnum(CondicionIva).optional(),
    nro_iibb: z.string().optional().nullable(),
    telefono: z.string().optional().nullable(),
    porcentaje_facturacion: z.number().min(0).max(100).optional(),
    saldo_blanco: z.number().optional(),
    saldo_interno: z.number().optional(),
  })
});

export const updateClientSchema = z.object({
  body: z.object({
    razon_social: z.string().min(3, 'La razón social debe tener al menos 3 caracteres').optional(),
    cuit: z.string()
      .transform((val) => val.replace(/[-\s.]/g, ''))
      .refine((val) => val.length >= 1 && val.length <= 11, 'El CUIT o documento debe tener entre 1 y 11 dígitos')
      .optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
    direccion: z.string().optional().nullable(),
    condicion_iva: z.nativeEnum(CondicionIva).optional(),
    nro_iibb: z.string().optional().nullable(),
    telefono: z.string().optional().nullable(),
    porcentaje_facturacion: z.number().min(0).max(100).optional(),
    saldo_blanco: z.number().optional(),
    saldo_interno: z.number().optional(),
    saldo_deuda: z.number().optional(),
  })
});
