import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import api from './api';

// ─── TIPOS ───────────────────────────────────────────────────────────────────
interface EmisorConfig {
  razon_social: string;
  cuit_emisor: string;
  domicilio_fiscal: string;
  condicion_iva_emisor: string;
  inicio_actividades: string;
  punto_venta: number;
}

// Fetch del emisor desde la base de datos (configuración)
async function getEmisor(): Promise<EmisorConfig> {
  try {
    const res = await api.get('/config');
    return res.data;
  } catch {
    // Fallback si la API falla (no debería ocurrir)
    return {
      razon_social: 'EMISOR SIN CONFIGURAR',
      cuit_emisor: '00-00000000-0',
      domicilio_fiscal: 'Domicilio no configurado',
      condicion_iva_emisor: 'Responsable Inscripto',
      inicio_actividades: '',
      punto_venta: 1,
    };
  }
}

// ─── MAPA DE TIPOS DE COMPROBANTE ─────────────────────────────────────────────
const CBTE_TIPO_MAP: Record<string, { numero: number; letra: string; descripcion: string }> = {
  'Factura A':        { numero: 1,  letra: 'A', descripcion: 'FACTURA' },
  'Factura B':        { numero: 6,  letra: 'B', descripcion: 'FACTURA' },
  'Factura C':        { numero: 11, letra: 'C', descripcion: 'FACTURA' },
  'Nota de Crédito A':{ numero: 3,  letra: 'A', descripcion: 'NOTA DE CRÉDITO' },
  'Nota de Crédito B':{ numero: 8,  letra: 'B', descripcion: 'NOTA DE CRÉDITO' },
};

// ─── GENERADOR DE QR AFIP ─────────────────────────────────────────────────────
async function generateAfipQR(sale: any, emisor: EmisorConfig): Promise<string> {
  const cbte = CBTE_TIPO_MAP[sale.tipo_comprobante] || { numero: 6, letra: 'B' };
  const fecha = new Date(sale.fecha || sale.createdAt).toISOString().split('T')[0];
  const caeNum = sale.cae ? sale.cae.replace('NC:', '') : '00000000000000';

  const qrData = {
    ver: 1,
    fecha,
    cuit: parseInt(emisor.cuit_emisor.replace(/-/g, '')),
    ptoVta: emisor.punto_venta,
    tipoCmp: cbte.numero,
    nroCmp: parseInt(sale.nro_comprobante || '1'),
    importe: parseFloat(Number(sale.monto_facturado_ars || sale.total_real_ars).toFixed(2)),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: sale.client?.condicion_iva === 'CONSUMIDOR_FINAL' ? 99 : 80,
    nroDocRec: parseInt((sale.client?.cuit || '0').replace(/-/g, '')),
    tipoCodAut: 'E',
    codAut: parseInt(caeNum),
  };

  const base64 = btoa(JSON.stringify(qrData));
  const url = `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
  return await QRCode.toDataURL(url, { width: 128, margin: 1 });
}

// ─── PDF DE FACTURA ELECTRÓNICA OFICIAL ──────────────────────────────────────
export const generateSalePDF = async (sale: any) => {
  try {
    if (!sale || !sale.client || !sale.items) {
      toast.error('Error: Datos de facturación incompletos.');
      return;
    }

    // Obtener datos del emisor desde la configuración del sistema
    const EMISOR = await getEmisor();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pW = doc.internal.pageSize.width;   // 210mm
    const pH = doc.internal.pageSize.height;  // 297mm

    const cbte = CBTE_TIPO_MAP[sale.tipo_comprobante] || { numero: 6, letra: 'B', descripcion: 'COMPROBANTE' };
    const isFiscal = !!sale.cae && !sale.cae.startsWith('NC:') || (sale.cae && sale.tipo_comprobante?.includes('Nota'));
    const esCreditNote = sale.cae?.startsWith('NC:');
    const caeReal = esCreditNote ? sale.cae.replace('NC:', '') : (sale.cae || '');

    // ── ENCABEZADO: Tres columnas ────────────────────────────────────────────
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(10, 10, pW - 20, 55);

    // Columna IZQUIERDA — Datos del emisor
    doc.setFillColor(255, 255, 255);
    doc.rect(10, 10, (pW - 20) * 0.42, 55, 'F');

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(EMISOR.razon_social, 15, 22);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Razón Social: ${EMISOR.razon_social}`, 15, 30);
    doc.text(`Domicilio Comercial: ${EMISOR.domicilio_fiscal}`, 15, 35);
    doc.text(`Condición frente al IVA: ${EMISOR.condicion_iva_emisor}`, 15, 40);
    doc.text(`Inicio de Actividades: ${EMISOR.inicio_actividades}`, 15, 45);

    // CUIT en grande
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`CUIT: ${EMISOR.cuit_emisor}`, 15, 57);

    // Columna CENTRAL — Tipo de comprobante (recuadro con letra)
    const centerX = pW / 2;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(centerX - 18, 10, centerX - 18, 65);
    doc.line(centerX + 18, 10, centerX + 18, 65);

    // Letra del comprobante
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(cbte.letra, centerX, 36, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('COD.', centerX, 43, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(String(cbte.numero).padStart(2, '0'), centerX, 49, { align: 'center' });

    // Columna DERECHA — Datos del comprobante
    const rightX = centerX + 22;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(cbte.descripcion, rightX, 20);

    const nroDisplay = sale.nro_comprobante
      ? `${String(EMISOR.punto_venta).padStart(4, '0')}-${sale.nro_comprobante}`
      : 'PENDIENTE';

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`N°: ${nroDisplay}`, rightX, 29);
    doc.text(`Fecha: ${new Date(sale.fecha || sale.createdAt).toLocaleDateString('es-AR')}`, rightX, 36);
    doc.text(`Punto de Venta: ${String(EMISOR.punto_venta).padStart(4, '0')}`, rightX, 43);

    if (isFiscal || esCreditNote) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 102, 0);
      doc.text(`CAE N°: ${caeReal}`, rightX, 51);
      if (sale.vto_cae) {
        doc.text(`Vto. CAE: ${new Date(sale.vto_cae).toLocaleDateString('es-AR')}`, rightX, 57);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 0, 0);
      doc.text('⚠ SIN CAE — NO VÁLIDA FISCALMENTE', rightX, 51);
    }

    // ── DATOS DEL RECEPTOR ─────────────────────────────────────────────────
    const rY = 72;
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(10, rY, pW - 20, 22);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('DATOS DEL RECEPTOR', 13, rY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Razón Social: ${sale.client.razon_social || 'S/D'}`, 13, rY + 12);
    doc.text(`CUIT: ${sale.client.cuit || 'S/D'}`, 13, rY + 17);
    doc.text(`Domicilio: ${sale.client.direccion || 'No especificado'}`, 75, rY + 12);
    doc.text(`Cond. IVA: ${sale.client.condicion_iva?.replace(/_/g, ' ') || 'S/D'}`, 75, rY + 17);

    // ── TABLA DE ÍTEMS ─────────────────────────────────────────────────────
    const tableRows = sale.items.map((item: any) => {
      const cantKg = item.cantidad * Number(item.product?.peso_kg || 0);
      const precioUnitArs = Number(item.precio_unitario_ars || 0);
      const subtotalNeto = precioUnitArs * cantKg;
      const ivaRate = Number(item.iva_tasa || 21);
      const ivaImporte = subtotalNeto * (ivaRate / 100);
      return [
        item.product?.nombre || 'Producto Desconocido',
        `${item.cantidad} BU`,
        `${cantKg.toFixed(2)} KG`,
        `${ivaRate.toFixed(0)}%`,
        `$${precioUnitArs.toFixed(4)}`,
        `$${subtotalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        `$${ivaImporte.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      ];
    });

    autoTable(doc, {
      startY: rY + 27,
      head: [['DESCRIPCIÓN', 'CANT', 'TOTAL KG', 'IVA', 'P.UNIT $/KG', 'NETO', 'IVA $']],
      body: tableRows,
      headStyles: {
        fillColor: [25, 25, 25],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 52 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 10 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 28 },
        6: { halign: 'right', cellWidth: 22 },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 10, right: 10 },
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 },
      bodyStyles: { textColor: [40, 40, 40] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 140;

    // ── TOTALES ───────────────────────────────────────────────────────────
    const subtotal = Number(sale.subtotal_ars || 0);
    const iva = Number(sale.iva_ars || 0);
    const total = Number(sale.monto_facturado_ars || sale.total_real_ars || 0);
    const cotizacion = Number(sale.cotizacion_dolar_usada || 1);

    const totalsX = pW - 10;
    const totalsStartY = finalY + 6;

    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(pW - 80, totalsStartY - 4, 70, 34);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('SUBTOTAL NETO:', totalsX - 68, totalsStartY + 2);
    doc.text(`$${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, totalsX, totalsStartY + 2, { align: 'right' });

    doc.text('IVA:', totalsX - 68, totalsStartY + 9);
    doc.text(`$${iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, totalsX, totalsStartY + 9, { align: 'right' });

    doc.setDrawColor(180);
    doc.line(pW - 80, totalsStartY + 13, pW - 10, totalsStartY + 13);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('TOTAL:', totalsX - 68, totalsStartY + 21);
    doc.text(`$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, totalsX, totalsStartY + 21, { align: 'right' });

    // Cotización referencial
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(130);
    doc.text(`Cotización USD de referencia: $${cotizacion.toFixed(2)}`, 10, totalsStartY + 6);

    // ── SECCIÓN FISCAL INFERIOR: QR + CAE ─────────────────────────────────
    const footerY = pH - 42;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(10, footerY, pW - 10, footerY);

    if (isFiscal || esCreditNote) {
      // QR Code
      try {
        const qrDataUrl = await generateAfipQR(sale, EMISOR);
        doc.addImage(qrDataUrl, 'PNG', 12, footerY + 4, 30, 30);
      } catch (e) {
        console.warn('No se pudo generar el QR:', e);
      }

      // Datos fiscales junto al QR
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('COMPROBANTE AUTORIZADO POR AFIP / ARCA', 46, footerY + 10);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(`CAE N°: ${caeReal}`, 46, footerY + 17);

      const vtoStr = sale.vto_cae
        ? new Date(sale.vto_cae).toLocaleDateString('es-AR')
        : '—';
      doc.text(`Fecha de Vto. del CAE: ${vtoStr}`, 46, footerY + 23);
      doc.text(`Tipo de Comprobante: ${cbte.descripcion} ${cbte.letra}`, 46, footerY + 29);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120);
      doc.text('Consulte la validez en www.afip.gob.ar/fe/qr', 46, footerY + 35);
    } else {
      // Comprobante sin CAE — advertencia
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(160, 0, 0);
      doc.text('⚠ COMPROBANTE INTERNO — NO VÁLIDO FISCALMENTE ANTE ARCA/AFIP', pW / 2, footerY + 14, { align: 'center' });
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('Para emitir factura válida, procese el comprobante en el sistema antes de entregar este documento.', pW / 2, footerY + 20, { align: 'center' });
    }

    // ── BORDE GENERAL ─────────────────────────────────────────────────────
    doc.setDrawColor(160);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pW - 10, pH - 10);

    // Guardar
    const fileName = isFiscal || esCreditNote
      ? `Factura_${cbte.letra}_${nroDisplay?.replace(/-/g, '_') || sale.id}.pdf`
      : `Comprobante_Interno_${String(sale.id).padStart(6, '0')}.pdf`;

    doc.save(fileName);
  } catch (error) {
    console.error('Error generando PDF fiscal:', error);
    toast.error('Error al generar el PDF. Revise la consola.');
  }
};

// ─── PDF DE PRESUPUESTO / COTIZACIÓN ─────────────────────────────────────────
export const generateQuotationPDF = (quotation: any) => {
  try {
    if (!quotation || !quotation.client || !quotation.items) {
      toast.error('Error: Datos de cotización incompletos.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pW = doc.internal.pageSize.width;
    const pH = doc.internal.pageSize.height;

    // Borde exterior
    doc.setDrawColor(160);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pW - 10, pH - 10);

    // Header verde Mascolo
    doc.setFillColor(44, 85, 23);
    doc.rect(10, 10, pW - 20, 30, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Mascolo Químicos', 15, 23);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('PRESUPUESTO / COTIZACIÓN', 15, 31);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`N°: ${String(quotation.id).padStart(6, '0')}`, pW - 15, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Fecha: ${new Date(quotation.fecha).toLocaleDateString('es-AR')}`, pW - 15, 28, { align: 'right' });
    doc.text(`Validez: ${quotation.validez_dias} días`, pW - 15, 34, { align: 'right' });

    // Client Box
    const rY = 47;
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(10, rY, pW - 20, 22);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('DESTINATARIO', 13, rY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Razón Social: ${quotation.client.razon_social || 'S/D'}`, 13, rY + 12);
    doc.text(`CUIT: ${quotation.client.cuit || 'S/D'}`, 13, rY + 17);
    doc.text(`Domicilio: ${quotation.client.direccion || 'No especificado'}`, 75, rY + 12);
    doc.text(`Cond. IVA: ${quotation.client.condicion_iva?.replace(/_/g, ' ') || 'S/D'}`, 75, rY + 17);

    // Items Table
    const tableRows = quotation.items.map((item: any) => {
      const cantKg = item.cantidad * Number(item.product?.peso_kg || 0);
      const precioUsd = Number(item.precio_unitario_usd || 0);
      const subtotalUsd = cantKg * precioUsd;
      const cotizacion = Number(quotation.cotizacion_dolar_usada || 1);
      const subtotalArs = subtotalUsd * cotizacion;
      return [
        item.product?.nombre || 'Producto Desconocido',
        `${item.cantidad} BU`,
        `${cantKg.toFixed(2)} KG`,
        `USD ${precioUsd.toFixed(4)}`,
        `USD ${subtotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `$${subtotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      ];
    });

    autoTable(doc, {
      startY: rY + 28,
      head: [['DESCRIPCIÓN', 'CANT', 'TOTAL KG', 'P.UNIT (USD/KG)', 'SUBTOTAL USD', 'SUBTOTAL ARS']],
      body: tableRows,
      headStyles: { fillColor: [44, 85, 23], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 55 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 30 },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 10, right: 10 },
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    const cotizacion = Number(quotation.cotizacion_dolar_usada || 1);
    const totalArs = Number(quotation.total_real_ars || 0);
    const totalUsd = totalArs / cotizacion;

    const totalsX = pW - 10;
    const tY = finalY + 6;

    doc.setDrawColor(200);
    doc.rect(pW - 80, tY - 4, 70, 28);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('TOTAL USD estimado:', totalsX - 68, tY + 3);
    doc.text(`USD ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, totalsX, tY + 3, { align: 'right' });
    doc.text(`Cotización: $${cotizacion.toFixed(2)}`, totalsX - 68, tY + 10);

    doc.line(pW - 80, tY + 13, pW - 10, tY + 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('TOTAL ARS:', totalsX - 68, tY + 20);
    doc.text(`$${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, totalsX, tY + 20, { align: 'right' });

    // Footer
    const footerY = pH - 22;
    doc.setLineWidth(0.2);
    doc.setDrawColor(180);
    doc.line(10, footerY, pW - 10, footerY);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Este presupuesto tiene carácter informativo. Su validez está sujeta a los días indicados y a la disponibilidad de stock.', pW / 2, footerY + 6, { align: 'center' });
    doc.text('El precio en ARS puede variar según la cotización del dólar al momento de facturación.', pW / 2, footerY + 11, { align: 'center' });

    doc.save(`Presupuesto_${String(quotation.id).padStart(6, '0')}.pdf`);
  } catch (error) {
    console.error('Error generando PDF de cotización:', error);
    toast.error('Error al generar el PDF.');
  }
};

// ─── ESTADO DE CUENTA ─────────────────────────────────────────────────────────
export const generateAccountStatementPDF = (client: any, transactions: any[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(44, 85, 23);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA', 15, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Mascolo Químicos - Facturador Fiscal', 15, 32);

  doc.setTextColor(44, 85, 23);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(client.razon_social.toUpperCase(), 15, 55);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`CUIT: ${client.cuit}`, 15, 62);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`, 15, 67);

  doc.setDrawColor(200);
  doc.line(pageWidth - 85, 50, pageWidth - 15, 50);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('RESUMEN DE SALDOS', pageWidth - 85, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Saldo en Blanco:', pageWidth - 85, 65);
  doc.text(`$${Number(client.saldo_blanco).toLocaleString('es-AR')}`, pageWidth - 15, 65, { align: 'right' });

  doc.text('Saldo Gestión:', pageWidth - 85, 71);
  doc.text(`$${Number(client.saldo_negro).toLocaleString('es-AR')}`, pageWidth - 15, 71, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DEUDA TOTAL:', pageWidth - 85, 80);
  doc.text(`$${Number(client.saldo_deuda).toLocaleString('es-AR')}`, pageWidth - 15, 80, { align: 'right' });

  const tableData = transactions.map(t => [
    new Date(t.fecha).toLocaleDateString('es-AR'),
    t.tipo === 'FACTURACIÓN' ? `FACTURACIÓN #${String(t.id).padStart(5, '0')}` : 'COBRO REGISTRADO',
    t.tipo_comprobante || (t.tipo === 'COBRO' ? t.metodo_pago : '—'),
    t.tipo === 'FACTURACIÓN' ? `$${Number(t.total_real_ars).toLocaleString('es-AR')}` : '—',
    t.tipo === 'COBRO' ? `$${Number(t.monto_ars).toLocaleString('es-AR')}` : '—',
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['FECHA', 'CONCEPTO', 'DETALLE', 'DEBE (+)', 'HABER (-)']],
    body: tableData,
    headStyles: { fillColor: [44, 85, 23], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9 },
  });

  doc.save(`Estado_Cuenta_${client.razon_social.replace(/\s+/g, '_')}.pdf`);
};
