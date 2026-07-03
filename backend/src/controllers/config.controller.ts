import { Request, Response } from 'express';
import { ConfigService } from '../services/config.service';
import { asyncHandler } from '../utils/asyncHandler';

export class ConfigController {
  static get = asyncHandler(async (_req: Request, res: Response) => {
    const config = await ConfigService.get();
    res.json(config);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const {
      razon_social,
      cuit_emisor,
      domicilio_fiscal,
      condicion_iva_emisor,
      inicio_actividades,
      punto_venta,
      modo_produccion,
    } = req.body;

    const updated = await ConfigService.update({
      razon_social,
      cuit_emisor,
      domicilio_fiscal,
      condicion_iva_emisor,
      inicio_actividades,
      punto_venta: punto_venta !== undefined ? Number(punto_venta) : undefined,
      modo_produccion,
    });

    res.json(updated);
  });
}
