import { Request, Response } from 'express';
import { SaleService } from '../services/sale.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class SaleController {
  static billSale = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { mode, impactBalance, customPrices, cotizacion_usada } = req.body; 
    
    const sale = await SaleService.processBilling(
      Number(id), 
      mode, 
      impactBalance, 
      customPrices, 
      Number(cotizacion_usada)
    );
    res.json(sale);
  });

  static creditNote = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const sale = await SaleService.processCreditNote(Number(id));
    res.json(sale);
  });

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
    console.log('[SaleController] Creando venta:', JSON.stringify(req.body, null, 2));
    try {
      const sale = await SaleService.create(req.body);
      res.status(201).json(sale);
    } catch (error: any) {
      console.error('[SaleController] Error detallado:', error);
      throw error;
    }
  });
}
