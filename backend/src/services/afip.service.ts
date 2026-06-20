import Afip from '@afipsdk/afip.js';
import path from 'path';
import { AppError } from '../utils/AppError';

/**
 * Servicio para interactuar con los Web Services de ARCA (AFIP)
 */
export class AfipService {
  private static afip: any;

  /**
   * Inicializa la instancia de Afip.js
   */
  private static init() {
    if (this.afip) return;

    const CUIT = process.env.AFIP_CUIT || '20409318550';
    // Volvemos a producción para usar el certificado que ya tenemos
    const isProduction = true; 
    
    const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
    const certPath = path.join(baseDir, 'afip_res', 'cert.crt');
    const keyPath = path.join(baseDir, 'afip_res', 'key.key');

    this.afip = new Afip({
      CUIT: parseInt(CUIT),
      production: isProduction,
      cert: certPath, 
      key: keyPath,
      access_token: 'none'
    } as any);
  }

  /**
   * Solicita el CAE para una factura electrónica
   */
  static async createInvoice(sale: any) {
    this.init();

    try {
      const lastVoucher = await this.afip.ElectronicBilling.getLastVoucher(1, sale.tipo_comprobante === 'Factura A' ? 1 : 6); 
      const nextVoucher = lastVoucher + 1;

      const date = parseInt(new Date().toISOString().replace(/-/g, '').slice(0, 8));

      const cbteTipoMap: Record<string, number> = {
        'Factura A': 1,
        'Factura B': 6,
        'Factura C': 11,
        'Nota de Crédito A': 3,
        'Nota de Crédito B': 8
      };

      const cbteTipo = cbteTipoMap[sale.tipo_comprobante] || 1;

      let docTipo = 80; 
      let docNro = parseInt(sale.client.cuit.replace(/-/g, ''));

      if (sale.client.condicion_iva === 'CONSUMIDOR_FINAL' && (!sale.client.cuit || sale.client.cuit === '0')) {
        docTipo = 99;
        docNro = 0;
      }

      const data = {
        'CantReg': 1,
        'PtoVta': 1,
        'CbteTipo': cbteTipo,
        'Concepto': 1, 
        'DocTipo': docTipo,
        'DocNro': docNro,
        'CbteDesde': nextVoucher,
        'CbteHasta': nextVoucher,
        'CbteFch': date,
        'ImpTotal': parseFloat(sale.monto_facturado_ars.toFixed(2)),
        'ImpTotConc': 0,
        'ImpNeto': parseFloat(sale.subtotal_ars.toFixed(2)),
        'ImpOpEx': 0,
        'ImpIVA': parseFloat(sale.iva_ars.toFixed(2)),
        'ImpTrib': 0,
        'MonId': 'PES',
        'MonCotiz': 1,
        'Iva': [
          {
            'Id': 5, 
            'BaseImp': parseFloat(sale.subtotal_ars.toFixed(2)),
            'Importe': parseFloat(sale.iva_ars.toFixed(2))
          }
        ]
      };

      const result = await this.afip.ElectronicBilling.createVoucher(data);

      return {
        cae: result.CAE,
        vto_cae: result.CAEFchVto,
        nro_comprobante: String(nextVoucher).padStart(8, '0')
      };
    } catch (error: any) {
      console.error('Error AFIP:', error);
      throw new AppError(`Error al comunicar con ARCA: ${error.message}`, 500);
    }
  }

  static async getVoucherTypes() {
    this.init();
    return await this.afip.ElectronicBilling.getVoucherTypes();
  }

  static async getDocumentTypes() {
    this.init();
    return await this.afip.ElectronicBilling.getDocumentTypes();
  }
}
