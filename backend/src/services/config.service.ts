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

  /**
   * Guarda los certificados recibidos desde el frontend.
   */
  static async saveCertificates(certText: string, keyText: string, isTest: boolean = false) {
    const fs = require('fs');
    const path = require('path');
    
    const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
    const afipResDir = path.join(baseDir, 'afip_res');
    
    if (!fs.existsSync(afipResDir)) {
      fs.mkdirSync(afipResDir, { recursive: true });
    }

    const certPath = path.join(afipResDir, isTest ? 'cert_test.crt' : 'cert.crt');
    const keyPath = path.join(afipResDir, isTest ? 'key_test.key' : 'key.key');

    fs.writeFileSync(certPath, certText.trim(), 'utf8');
    fs.writeFileSync(keyPath, keyText.trim(), 'utf8');

    return { success: true, message: isTest ? 'Certificados de prueba guardados correctamente' : 'Certificados de producción guardados correctamente' };
  }
}
