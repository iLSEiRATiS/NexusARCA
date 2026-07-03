import { Afip } from '@cafecafe/afip.ts';
import path from 'path';
import fs from 'fs';
import tls from 'tls';
import { AppError } from '../utils/AppError';
import prisma from '../config/prisma';

// Ajuste para la conexión con servidores de AFIP antiguos en Node 18+
tls.DEFAULT_CIPHERS = 'DEFAULT@SECLEVEL=0';

/**
 * Servicio para interactuar con los Web Services de ARCA (AFIP)
 */
export class AfipService {
  private static afip: any;
  private static currentMode: boolean | null = null;

  /**
   * Inicializa (o reinicializa si cambió el modo) la instancia de Afip.js
   * leyendo configuración desde la base de datos.
   */
  private static async init() {
    // Leer configuración actual de la DB
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const isProduction = settings?.modo_produccion ?? false;

    // Reinicializar si cambió el modo de producción
    if (this.afip && this.currentMode === isProduction) return;

    const CUIT = process.env.AFIP_CUIT || '20409318550';
    const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();

    const certPath = path.join(baseDir, 'afip_res', isProduction ? 'cert.crt' : 'cert_test.crt');
    const keyPath  = path.join(baseDir, 'afip_res', isProduction ? 'key.key'  : 'key_test.key');

    try {
      this.afip = new Afip({
        cuit: parseInt(CUIT),
        production: isProduction,
        cert: fs.readFileSync(certPath, 'utf8'),
        key:  fs.readFileSync(keyPath,  'utf8')
      });
      this.currentMode = isProduction;
      console.log(`[AfipService] Inicializado en modo ${isProduction ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN'}`);
    } catch (err: any) {
      console.error(`Error cargando certificados AFIP (Producción: ${isProduction}):`, err.message);
      throw new AppError(
        `No se encontraron los certificados de AFIP (${isProduction ? 'producción' : 'homologación'}). Verifique los archivos en afip_res/.`,
        500
      );
    }
  }


  /**
   * Solicita el CAE para una factura electrónica
   */
  static async createInvoice(sale: any) {
    await this.init();

    // Leer punto de venta desde la configuración guardada en DB
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const puntoVenta = settings?.punto_venta ?? 1;

    try {
      const cbteTipoMap: Record<string, number> = {
        'Factura A':         1,
        'Factura B':         6,
        'Factura C':         11,
        'Nota de Crédito A': 3,
        'Nota de Crédito B': 8,
      };
      const cbteTipo = cbteTipoMap[sale.tipo_comprobante] || 6;

      const lastVoucherData = await this.afip.electronicBillingService.getLastVoucher(puntoVenta, cbteTipo);
      const nextVoucher = (lastVoucherData.CbteNro || 0) + 1;

      const date = parseInt(new Date().toISOString().replace(/-/g, '').slice(0, 8));

      let docTipo = 80;
      let docNro = parseInt((sale.client?.cuit || '0').replace(/-/g, ''));

      if (sale.client?.condicion_iva === 'CONSUMIDOR_FINAL' && (!sale.client.cuit || sale.client.cuit === '0')) {
        docTipo = 99;
        docNro = 0;
      }

      const data: any = {
        'CantReg':    1,
        'PtoVta':     puntoVenta,
        'CbteTipo':   cbteTipo,
        'Concepto':   1,
        'DocTipo':    docTipo,
        'DocNro':     docNro,
        'CbteDesde':  nextVoucher,
        'CbteHasta':  nextVoucher,
        'CbteFch':    date,
        'ImpTotal':   parseFloat(Number(sale.monto_facturado_ars).toFixed(2)),
        'ImpTotConc': 0,
        'ImpNeto':    parseFloat(Number(sale.subtotal_ars).toFixed(2)),
        'ImpOpEx':    0,
        'ImpIVA':     parseFloat(Number(sale.iva_ars).toFixed(2)),
        'ImpTrib':    0,
        'MonId':      'PES',
        'MonCotiz':   1,
        'Iva': [
          {
            'Id':      5, // 21%
            'BaseImp': parseFloat(Number(sale.subtotal_ars).toFixed(2)),
            'Importe': parseFloat(Number(sale.iva_ars).toFixed(2)),
          }
        ]
      };

      if (sale.tipo_comprobante === 'Nota de Crédito A' && sale.comprobante_asociado) {
        data['CbtesAsoc'] = [
          {
            'Tipo':   1,
            'PtoVta': puntoVenta,
            'Nro':    parseInt(sale.comprobante_asociado),
          }
        ];
      }

      const result = await this.afip.electronicBillingService.createVoucher(data);

      return {
        cae: result.cae,
        vto_cae: result.caeFchVto,
        nro_comprobante: String(nextVoucher).padStart(8, '0'),
      };
    } catch (error: any) {
      console.error('Error AFIP:', error);
      throw new AppError(`Error al comunicar con ARCA: ${error.message}`, 500);
    }
  }

  static async getVoucherTypes() {
    await this.init();
    const res = await this.afip.electronicBillingService.getVoucherTypes();
    return res.ResultGet.CbteTipo || [];
  }


  static async getDocumentTypes() {
    this.init();
    const res = await this.afip.electronicBillingService.getDocumentTypes();
    return res.ResultGet.DocTipo || [];
  }
}
