import { Request, Response } from 'express';
import { SaleService } from '../services/sale.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class SaleController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const result = await SaleService.getAll(page, limit);
    res.json(result);
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const sale = await SaleService.getById(Number(req.params.id));
    if (!sale) {
      throw new AppError('Venta no encontrada', 404);
    }
    res.json(sale);
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const sale = await SaleService.create(req.body);
    res.status(201).json(sale);
  });
}
