import { Afip } from '@cafecafe/afip.ts';
import path from 'path';
import fs from 'fs';
import tls from 'tls';
import { AppError } from '../utils/AppError';

// Ajuste para la conexión con servidores de AFIP antiguos en Node 18+
tls.DEFAULT_CIPHERS = 'DEFAULT@SECLEVEL=0';

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
    // Usamos el entorno de Homologación (Testing)
    const isProduction = false; 
    
    const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
    // En homologación usamos los certificados de prueba (cert_test.crt / key_test.key)
    const certPath = path.join(baseDir, 'afip_res', isProduction ? 'cert.crt' : 'cert_test.crt');
    const keyPath = path.join(baseDir, 'afip_res', isProduction ? 'key.key' : 'key_test.key');

    try {
      this.afip = new Afip({
        cuit: parseInt(CUIT),
        production: isProduction,
        cert: fs.readFileSync(certPath, 'utf8'), 
        key: fs.readFileSync(keyPath, 'utf8')
      });
    } catch (err: any) {
      console.error(`Error cargando certificados AFIP (Producción: ${isProduction}):`, err.message);
      throw new AppError(`No se encontraron los certificados de AFIP en homologación. Por favor, genera cert_test.crt y key_test.key.`, 500);
    }
  }

  /**
   * Solicita el CAE para una factura electrónica
   */
  static async createInvoice(sale: any) {
    this.init();

    try {
      const lastVoucherData = await this.afip.electronicBillingService.getLastVoucher(1, sale.tipo_comprobante === 'Factura A' ? 1 : 6); 
      const nextVoucher = (lastVoucherData.CbteNro || 0) + 1;

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

      const data: any = {
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

      if (sale.tipo_comprobante === 'Nota de Crédito A' && sale.comprobante_asociado) {
        data['CbtesAsoc'] = [
          {
            'Tipo': 1, 
            'PtoVta': 1,
            'Nro': parseInt(sale.comprobante_asociado)
          }
        ];
      }

      const result = await this.afip.electronicBillingService.createVoucher(data);

      return {
        cae: result.cae,
        vto_cae: result.caeFchVto,
        nro_comprobante: String(nextVoucher).padStart(8, '0')
      };
    } catch (error: any) {
      console.error('Error AFIP:', error);
      throw new AppError(`Error al comunicar con ARCA: ${error.message}`, 500);
    }
  }

  static async getVoucherTypes() {
    this.init();
    const res = await this.afip.electronicBillingService.getVoucherTypes();
    return res.ResultGet.CbteTipo || [];
  }

  static async getDocumentTypes() {
    this.init();
    const res = await this.afip.electronicBillingService.getDocumentTypes();
    return res.ResultGet.DocTipo || [];
  }
}
