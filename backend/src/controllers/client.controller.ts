import { Request, Response } from 'express';
import { ClientService } from '../services/client.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class ClientController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const clients = await ClientService.getAll();
    res.json(clients);
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const client = await ClientService.getById(Number(req.params.id));
    if (!client) {
      throw new AppError('Cliente no encontrado', 404);
    }
    res.json(client);
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const existing = await ClientService.getByCuit(req.body.cuit);
    if (existing) {
      throw new AppError('Ya existe un cliente con ese CUIT', 400);
    }
    const client = await ClientService.create(req.body);
    res.status(201).json(client);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const client = await ClientService.update(Number(req.params.id), req.body);
    res.json(client);
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await ClientService.delete(Number(req.params.id));
    res.status(204).send();
  });

  static registerPayment = asyncHandler(async (req: Request, res: Response) => {
    // Aceptamos tanto monto como monto_ars, e imputacion como tipo
    const monto = req.body.monto || req.body.monto_ars;
    const tipo = req.body.imputacion || req.body.tipo || 'MIXTO';
    const metodo = req.body.metodo || 'EFECTIVO';
    const referencia = req.body.referencia || '';
    
    const payment = await ClientService.registerPayment(
      Number(req.params.id), 
      Number(monto), 
      tipo, 
      metodo,
      referencia
    );
    res.status(201).json(payment);
  });

  static syncAll = asyncHandler(async (req: Request, res: Response) => {
    const clients = await ClientService.getAll();
    for (const client of clients) {
      await ClientService.syncBalance(client.id);
    }
    res.json({ message: 'Saldos sincronizados correctamente' });
  });
}
