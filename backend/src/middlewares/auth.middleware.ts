import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'engroncho_master_key_2026';

export const protect = (req: any, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('No autorizado para acceder a este recurso', 401));
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError('Token inválido o expirado', 401));
  }
};
