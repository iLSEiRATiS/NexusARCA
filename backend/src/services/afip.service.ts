import { Afip } from '@cafecafe/afip.ts';
import path from 'path';
import fs from 'fs';
import tls from 'tls';
import { AppError } from '../utils/AppError';
import prisma from '../config/prisma';

// Ajuste para la conexión con servidores de AFIP antiguos en Node 18+
tls.DEFAULT_CIPHERS = 'DEFAULT@SECLEVEL=0';

// ── Mapeo de condición IVA interna → código ARCA (RG 5616, manual pág. 196-197) ──
const CONDICION_IVA_RECEPTOR_MAP: Record<string, number> = {
  'RESPONSABLE_INSCRIPTO': 1,
  'MONOTRIBUTO':           6,
  'EXENTO':                4,
  'CONSUMIDOR_FINAL':      5,
  'NO_CATEGORIZADO':       7,
};

// ── Mapeo de tasa IVA → Id AFIP (FEParamGetTiposIva) ──
const IVA_TASA_TO_AFIP_ID: Record<number, number> = {
  0:    3,   // 0%
  2.5:  9,   // 2.5%
  5:    8,   // 5%
  10.5: 4,   // 10.5%
  21:   5,   // 21%
  27:   6,   // 27%
};

/**
 * Servicio para interactuar con los Web Services de ARCA (AFIP)
 * Cumple con Manual ARCA-COMPG v4.2 — RG 4291
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

    // En Producción se usa el CUIT real. En homologación SE DEBE usar el CUIT de prueba (20409318550) asociado a los certificados test.
    const CUIT = isProduction ? (process.env.AFIP_CUIT || '20106102741') : '20409318550';
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
      console.log(`[AfipService] Inicializado en modo ${isProduction ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN'} con CUIT: ${CUIT}`);
    } catch (err: any) {
      console.error(`Error cargando certificados AFIP (Producción: ${isProduction}):`, err.message);
      throw new AppError(
        `No se encontraron los certificados de AFIP (${isProduction ? 'producción' : 'homologación'}). Verifique los archivos en afip_res/.`,
        500
      );
    }
  }

  /**
   * Redondea a 2 decimales de forma segura (evita errores de punto flotante).
   */
  private static round2(value: number): number {
    return parseFloat(value.toFixed(2));
  }

  /**
   * Solicita el CAE para una factura electrónica.
   * Cumple con FECAESolicitar según manual ARCA-COMPG v4.2.
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

      // ── Clase del comprobante para validaciones ──
      const isClaseA = [1, 2, 3, 4, 5].includes(cbteTipo);
      const isNotaCredito = [3, 8].includes(cbteTipo);

      const lastVoucherData = await this.afip.electronicBillingService.getLastVoucher(puntoVenta, cbteTipo);
      const nextVoucher = (lastVoucherData.CbteNro || 0) + 1;

      // [HM-1] CbteFch como string(8) formato yyyymmdd (manual pág. 27)
      const now = new Date();
      const date = now.toISOString().replace(/-/g, '').slice(0, 8);

      // ── DocTipo / DocNro ──
      let docTipo = 80; // CUIT por defecto
      let docNro = parseInt((sale.client?.cuit || '0').replace(/-/g, ''));

      if (sale.client?.condicion_iva === 'CONSUMIDOR_FINAL' && (!sale.client.cuit || sale.client.cuit === '0')) {
        docTipo = 99;
        docNro = 0;
      }

      // [HC-6] Validación 10013: Para comprobantes clase A, DocTipo DEBE ser 80 (CUIT)
      if (isClaseA && docTipo !== 80) {
        throw new AppError(
          'Para comprobantes clase A, el receptor debe identificarse con CUIT (DocTipo 80). El cliente no tiene CUIT válido.',
          400
        );
      }
      if (isClaseA && (!docNro || docNro === 0)) {
        throw new AppError(
          'Para comprobantes clase A, el CUIT del receptor es obligatorio y no puede ser 0.',
          400
        );
      }

      // ── Construir array IVA dinámico (val. 10018-10023, 10051, 10061, 10070) ──
      const ivaArray: Array<{ Id: number; BaseImp: number; Importe: number }> = [];
      const ivaGroup: Record<number, { base: number; importe: number }> = {};
      
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          const tasa = Number(item.iva_tasa);
          if (tasa > 0) {
            const afipId = IVA_TASA_TO_AFIP_ID[tasa] || 5;
            if (!ivaGroup[afipId]) ivaGroup[afipId] = { base: 0, importe: 0 };
            
            ivaGroup[afipId].base += Number(item.precio_unitario_ars) * item.cantidad;
            ivaGroup[afipId].importe += Number(item.iva_importe_ars) || (Number(item.precio_unitario_ars) * item.cantidad * (tasa / 100));
          }
        }
        
        // val. 10022: El campo Id en AlicIVA no debe repetirse (ya agrupado)
        for (const id in ivaGroup) {
          ivaArray.push({
            'Id': parseInt(id),
            'BaseImp': this.round2(ivaGroup[id].base),
            'Importe': this.round2(ivaGroup[id].importe)
          });
        }
      } else {
        // Fallback si no vienen items (por compatibilidad hacia atrás)
        ivaArray.push({
          'Id':      5,
          'BaseImp': this.round2(Number(sale.subtotal_ars)),
          'Importe': this.round2(Number(sale.iva_ars)),
        });
      }

      // ── Tributos (val. 10024-10029) ──
      const totalTributos = this.round2(Number(sale.percepciones_iibb_ars || 0) + Number(sale.percepciones_iva_ars || 0));

      // ── [HC-5] ImpTotal = ImpTotConc + ImpNeto + ImpOpEx + ImpTrib + ImpIVA (val. 10048) ──
      // Redondear cada componente individualmente ANTES de sumar para evitar error de punto flotante
      const impTotConc = 0;
      const impNeto = this.round2(Number(sale.subtotal_ars));
      const impOpEx = 0;
      const impIVA = this.round2(Number(sale.iva_ars));
      const impTrib = totalTributos;
      const impTotal = this.round2(impTotConc + impNeto + impOpEx + impTrib + impIVA);

      // Nueva validación RG 5866/2026: Consumidor Final >= 10.000.000 requiere DNI/CUIT
      if (docTipo === 99 && impTotal >= 10000000) {
        throw new AppError(
          'Según RG 5866/2026, las facturas a Consumidor Final iguales o superiores a $10.000.000 requieren identificar al comprador con DNI, CUIL o CUIT. Por favor asigne un documento válido al cliente.',
          400
        );
      }

      // ── [HC-1] CondicionIVAReceptorId (RG 5616, manual pág. 25, 196-197) ──
      const condicionIvaReceptorId = CONDICION_IVA_RECEPTOR_MAP[sale.client?.condicion_iva] || undefined;

      const data: any = {
        'CantReg':    1,
        'PtoVta':     puntoVenta,
        'CbteTipo':   cbteTipo,
        'Concepto':   1,       // 1 = Productos
        'DocTipo':    docTipo,
        'DocNro':     docNro,
        'CbteDesde':  nextVoucher,
        'CbteHasta':  nextVoucher,
        'CbteFch':    date,
        'ImpTotal':   impTotal,
        'ImpTotConc': impTotConc,
        'ImpNeto':    impNeto,
        'ImpOpEx':    impOpEx,
        'ImpIVA':     impIVA,
        'ImpTrib':    impTrib,
        'MonId':      'PES',
        'MonCotiz':   1,
        'Iva':        ivaArray
      };

      // [HC-1] Agregar CondicionIVAReceptorId si está disponible
      if (condicionIvaReceptorId) {
        data['CondicionIVAReceptorId'] = condicionIvaReceptorId;
      }

      // ── Tributos array (val. 10024: Si ImpTrib > 0, Tributos es obligatorio) ──
      if (totalTributos > 0) {
        const tributosArray: Array<{ Id: number; Desc: string; BaseImp: number; Alic: number; Importe: number }> = [];
        if (Number(sale.percepciones_iibb_ars) > 0) {
          tributosArray.push({
            'Id': 2, 
            'Desc': 'Percepción IIBB',
            'BaseImp': impNeto,
            'Alic': 0, 
            'Importe': this.round2(Number(sale.percepciones_iibb_ars))
          });
        }
        if (Number(sale.percepciones_iva_ars) > 0) {
          tributosArray.push({
            'Id': 1, 
            'Desc': 'Percepción IVA',
            'BaseImp': impNeto,
            'Alic': 0,
            'Importe': this.round2(Number(sale.percepciones_iva_ars))
          });
        }
        data['Tributos'] = tributosArray;
      }

      // ── [HC-2] CbtesAsoc para Notas de Crédito (val. 10040, 10057-10062) ──
      if (isNotaCredito && sale.comprobante_asociado) {
        // Tipo del comprobante asociado: NC A (3) asocia Factura A (1), NC B (8) asocia Factura B (6)
        const tipoAsociado = cbteTipo === 3 ? 1 : 6;

        // Formatear fecha del comprobante asociado como string(8) yyyymmdd
        let cbteFchAsoc: string | undefined;
        if (sale.fecha_comprobante_asociado) {
          cbteFchAsoc = new Date(sale.fecha_comprobante_asociado).toISOString().replace(/-/g, '').slice(0, 8);
        }

        const cbteAsoc: any = {
          'Tipo':   tipoAsociado,
          'PtoVta': puntoVenta,
          'Nro':    parseInt(sale.comprobante_asociado),
        };

        if (cbteFchAsoc) {
          cbteAsoc['CbteFch'] = cbteFchAsoc;
        }

        data['CbtesAsoc'] = [cbteAsoc];
      }

      const result = await this.afip.electronicBillingService.createVoucher(data);
      console.log('RAW AFIP RESULT:', JSON.stringify(result, null, 2));

      // Si AFIP devuelve observaciones (rechazo lógico), extraer el mensaje
      if (!result.cae && (result.observaciones || (result.response && result.response.Errors))) {
         const errorMsgs = result.observaciones || result.response.Errors;
         throw new AppError(`Rechazado por AFIP: ${JSON.stringify(errorMsgs)}`, 400);
      }

      // Format YYYYMMDD to YYYY-MM-DD
      const vto = result.caeFchVto;
      const formattedVto = vto ? `${vto.substring(0,4)}-${vto.substring(4,6)}-${vto.substring(6,8)}` : '';

      return {
        cae: result.cae,
        vto_cae: formattedVto,
        nro_comprobante: String(nextVoucher).padStart(8, '0'),
      };
    } catch (error: any) {
      console.error('Error AFIP:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Error al comunicar con ARCA: ${error.message}`, 500);
    }
  }

  static async getVoucherTypes() {
    await this.init();
    const res = await this.afip.electronicBillingService.getVoucherTypes();
    return res.ResultGet.CbteTipo || [];
  }

  // [HM-2] Agregar await a init()
  static async getDocumentTypes() {
    await this.init();
    const res = await this.afip.electronicBillingService.getDocumentTypes();
    return res.ResultGet.DocTipo || [];
  }
}
