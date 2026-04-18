import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';

export class ProductController {
  static async getAll(req: Request, res: Response) {
    try {
      const products = await ProductService.getAll();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener productos' });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const product = await ProductService.getById(Number(req.params.id));
      if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json(product);
    } catch (error) {
      console.error('Error en ProductController:', error);
      res.status(500).json({ error: 'Error al obtener el producto' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const product = await ProductService.create(req.body);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: 'Error al crear producto' });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const product = await ProductService.update(Number(req.params.id), req.body);
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: 'Error al actualizar producto' });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await ProductService.delete(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Error al eliminar producto' });
    }
  }

  static async adjustStock(req: Request, res: Response) {
    const { cantidad, tipo, motivo } = req.body;
    try {
      const product = await ProductService.adjustStock(Number(req.params.id), cantidad, tipo, motivo);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
