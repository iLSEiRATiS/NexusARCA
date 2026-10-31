import { Request, Response } from 'express';
import { ClientService } from '../services/client.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { parseArgNumber } from '../utils/format';

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
    const cleanCuit = req.body.cuit ? String(req.body.cuit).replace(/[-\s.]/g, '') : '';
    const existing = await ClientService.getByCuit(cleanCuit);
    if (existing) {
      throw new AppError(`Ya existe un cliente registrado con el CUIT/documento ${cleanCuit} (${existing.razon_social})`, 400);
    }
    const client = await ClientService.create({
      ...req.body,
      cuit: cleanCuit
    });
    res.status(201).json(client);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const clientId = Number(req.params.id);
    if (req.body.cuit) {
      const cleanCuit = String(req.body.cuit).replace(/[-\s.]/g, '');
      const existing = await ClientService.getByCuit(cleanCuit);
      if (existing && existing.id !== clientId) {
        throw new AppError(`Ya existe otro cliente registrado con el CUIT/documento ${cleanCuit} (${existing.razon_social})`, 400);
      }
      req.body.cuit = cleanCuit;
    }
    const client = await ClientService.update(clientId, req.body);
    res.json(client);
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await ClientService.delete(Number(req.params.id));
    res.status(204).send();
  });

  static registerPayment = asyncHandler(async (req: Request, res: Response) => {
    // Aceptamos tanto monto como monto_ars, e imputacion como tipo
    const rawMonto = req.body.monto !== undefined ? req.body.monto : req.body.monto_ars;
    const monto = parseArgNumber(rawMonto);
    const tipo = req.body.imputacion || req.body.tipo || 'MIXTO';
    const metodo = req.body.metodo || 'EFECTIVO';
    const referencia = req.body.referencia || '';
    const fecha = req.body.fecha || undefined;
    const nro_cheque = req.body.nro_cheque || undefined;
    const fecha_vto_cheque = req.body.fecha_vto_cheque || undefined;
    const caja = req.body.caja || undefined;
    
    const payment = await ClientService.registerPayment(
      Number(req.params.id), 
      monto, 
      tipo, 
      metodo,
      referencia,
      fecha,
      { nro_cheque, fecha_vto_cheque, caja }
    );
    res.status(201).json(payment);
  });

  static loadCredit = asyncHandler(async (req: Request, res: Response) => {
    const clientId = Number(req.params.id);
    const rawMonto = req.body.monto !== undefined ? req.body.monto : req.body.monto_ars;
    const motivo = req.body.motivo || req.body.referencia || '';
    const fecha = req.body.fecha || undefined;
    const metodo = req.body.metodo || 'SALDO_A_FAVOR';
    const modo = req.body.modo || 'add';

    const updated = await ClientService.loadCredit(clientId, rawMonto, motivo, fecha, metodo, modo);
    res.json(updated);
  });

  static syncAll = asyncHandler(async (req: Request, res: Response) => {
    const clients = await ClientService.getAll();
    for (const client of clients) {
      await ClientService.syncBalance(client.id);
    }
    res.json({ message: 'Saldos sincronizados correctamente' });
  });

  static deletePayment = asyncHandler(async (req: Request, res: Response) => {
    await ClientService.deletePayment(Number(req.params.id), Number(req.params.paymentId));
    res.status(204).send();
  });
}
