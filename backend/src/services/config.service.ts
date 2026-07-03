import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

export class ConfigService {
  /**
   * Obtiene la configuración del sistema (Settings id=1).
   * Si no existe la crea con valores por defecto.
   */
  static async get() {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        cotizacion_dolar_actual: 1000,
        razon_social: 'EMISOR SIN CONFIGURAR',
        cuit_emisor: '00-00000000-0',
        domicilio_fiscal: '',
        condicion_iva_emisor: 'Responsable Inscripto',
        inicio_actividades: '',
        punto_venta: 1,
        modo_produccion: false,
      },
    });
    return settings;
  }

  /**
   * Actualiza los datos del emisor y/o configuración ARCA.
   */
  static async update(data: {
    razon_social?: string;
    cuit_emisor?: string;
    domicilio_fiscal?: string;
    condicion_iva_emisor?: string;
    inicio_actividades?: string;
    punto_venta?: number;
    modo_produccion?: boolean;
  }) {
    // Validar que el PV sea un número positivo si se envía
    if (data.punto_venta !== undefined && (data.punto_venta < 1 || data.punto_venta > 9999)) {
      throw new AppError('El Punto de Venta debe estar entre 1 y 9999', 400);
    }

    return await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        cotizacion_dolar_actual: 1000,
        razon_social: data.razon_social ?? 'EMISOR SIN CONFIGURAR',
        cuit_emisor: data.cuit_emisor ?? '00-00000000-0',
        domicilio_fiscal: data.domicilio_fiscal ?? '',
        condicion_iva_emisor: data.condicion_iva_emisor ?? 'Responsable Inscripto',
        inicio_actividades: data.inicio_actividades ?? '',
        punto_venta: data.punto_venta ?? 1,
        modo_produccion: data.modo_produccion ?? false,
      },
    });
  }
}
