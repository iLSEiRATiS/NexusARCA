import { Request, Response, NextFunction } from 'express';

// Wrapper para evitar usar try/catch en todos los controladores
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
