import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class ProductController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const products = await ProductService.getAll();
    res.json(products);
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const product = await ProductService.getById(Number(req.params.id));
    if (!product) {
      throw new AppError('Producto no encontrado', 404);
    }
    res.json(product);
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const product = await ProductService.create(req.body);
    res.status(201).json(product);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const product = await ProductService.update(Number(req.params.id), req.body);
    res.json(product);
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await ProductService.delete(Number(req.params.id));
    res.status(204).send();
  });

  static adjustStock = asyncHandler(async (req: Request, res: Response) => {
    const { cantidad, tipo, motivo, nro_lote, fecha_vencimiento } = req.body;
    const product = await ProductService.adjustStock(
      Number(req.params.id), 
      cantidad, 
      tipo, 
      motivo, 
      nro_lote, 
      fecha_vencimiento ? new Date(fecha_vencimiento) : undefined
    );
    res.json(product);
  });

  static updateBatch = asyncHandler(async (req: Request, res: Response) => {
    const { batchId } = req.params;
    const batch = await ProductService.updateBatch(Number(batchId), req.body);
    res.json(batch);
  });

  static deleteBatch = asyncHandler(async (req: Request, res: Response) => {
    const { batchId } = req.params;
    await ProductService.deleteBatch(Number(batchId));
    res.status(204).send();
  });
}
