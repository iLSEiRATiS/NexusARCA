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

  // Errores comunes de Prisma (ej: Unique constraint, Not Found)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      error = new AppError('Registro duplicado. Ya existe en la base de datos.', 409);
    } else if (err.code === 'P2025') {
      error = new AppError('Registro no encontrado.', 404);
    }
  }

  // Fallback si el error no es de nuestra clase AppError
  if (!(error instanceof AppError)) {
    error = new AppError('Ocurrió un error interno en el servidor.', 500, false);
  }

  res.status((error as AppError).statusCode).json({
    status: 'error',
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) // Stack trace solo en desarrollo
  });
};
