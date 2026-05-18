import { Request, Response } from 'express';
import { QuotationService } from '../services/quotation.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class QuotationController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const result = await QuotationService.getAll(page, limit);
    res.json(result);
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const quotation = await QuotationService.getById(Number(req.params.id));
    res.json(quotation);
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const quotation = await QuotationService.create(req.body);
    res.status(201).json(quotation);
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { estado } = req.body;
    const quotation = await QuotationService.updateStatus(Number(req.params.id), estado);
    res.json(quotation);
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await QuotationService.delete(Number(req.params.id));
    res.status(204).send();
  });

  static convertToSale = asyncHandler(async (req: Request, res: Response) => {
    const sale = await QuotationService.convertToSale(Number(req.params.id), req.body);
    res.status(201).json(sale);
  });
}
