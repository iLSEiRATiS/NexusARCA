import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = err;

  // Log de errores para documentación y rastreo interno
  console.error(`[Error] ${err.name}: ${err.message}`, err.stack);

  // Errores de validación de Zod
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    error = new AppError(`Validación fallida: ${message}`, 400);
  }

  // Errores comunes de Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : (err.meta?.target || 'campo');
      error = new AppError(`Registro duplicado. Ya existe un registro con ese ${target}.`, 409);
    } else if (err.code === 'P2025') {
      error = new AppError('Registro no encontrado en la base de datos.', 404);
    } else if (err.code === 'P2003') {
      error = new AppError('Violación de clave foránea o relación inexistente en la base de datos.', 400);
    } else if (err.code === 'P2021' || err.code === 'P2022') {
      error = new AppError(`Estructura de base de datos desactualizada (${err.message}). Ejecute 'prisma db push'.`, 500);
    } else {
      error = new AppError(`Error de base de datos (${err.code}): ${err.message}`, 500);
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    error = new AppError(`Error en los datos para la base de datos: ${err.message}`, 400);
  }

  // Fallback si el error no es de nuestra clase AppError
  if (!(error instanceof AppError)) {
    const message = err?.message || 'Ocurrió un error interno en el servidor.';
    error = new AppError(message, 500, false);
  }

  res.status((error as AppError).statusCode).json({
    status: 'error',
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) // Stack trace solo en desarrollo
  });
};
