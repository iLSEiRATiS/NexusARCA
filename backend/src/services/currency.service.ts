import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

interface DolarApiResponse {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export class CurrencyService {
  /**
   * Obtiene la cotización del dólar oficial (venta) en tiempo real.
   * Si la API externa falla, utiliza el último valor guardado en la base de datos como respaldo.
   */
  static async getDolarOficial(): Promise<number> {
    try {
      // Intentamos obtener el valor en tiempo real (DolarApi es el estándar gratuito más estable para BNA)
      const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
      
      if (!response.ok) {
        throw new Error(`Error HTTP de la API de Dólar: ${response.status}`);
      }

      const data: DolarApiResponse = await response.json();
      const cotizacionVenta = data.venta;

      // Actualizamos el respaldo en la base de datos de forma asíncrona (sin bloquear el flujo)
      this.updateFallbackRate(cotizacionVenta).catch(err => 
        console.error('[CurrencyService] Error actualizando el respaldo del dólar:', err)
      );

      return cotizacionVenta;
    } catch (error) {
      console.error('[CurrencyService] Fallo al consultar API externa. Usando fallback de DB.', error);
      
      // FALLBACK: Si no hay internet o la API cae, leemos el último valor de Settings
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      
      if (!settings) {
        throw new AppError('No se pudo obtener la cotización del dólar y no hay un valor de respaldo configurado en el sistema.', 503);
      }

      return Number(settings.cotizacion_dolar_actual);
    }
  }

  /**
   * Actualiza el valor de cotización de respaldo en la base de datos.
   */
  private static async updateFallbackRate(rate: number) {
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { cotizacion_dolar_actual: rate },
      create: { id: 1, cotizacion_dolar_actual: rate }
    });
  }
}
