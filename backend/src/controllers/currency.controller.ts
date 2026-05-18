import { Request, Response } from 'express';
import { CurrencyService } from '../services/currency.service';
import { asyncHandler } from '../utils/asyncHandler';

export class CurrencyController {
  static getDolarRate = asyncHandler(async (req: Request, res: Response) => {
    const rate = await CurrencyService.getDolarOficial();
    res.json({
      moneda: 'USD',
      tipo: 'OFICIAL_VENTA',
      cotizacion: rate,
      timestamp: new Date().toISOString()
    });
  });
}
