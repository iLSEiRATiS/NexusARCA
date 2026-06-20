import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export const generateSalePDF = (sale: any) => {
  try {
    if (!sale || !sale.client || !sale.items) {
      console.error('Datos de facturación incompletos para generar PDF', sale);
      toast.error('Error: Datos de facturación incompletos.');
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 85, 17); // #2C5511 (Verde Mascolo)
    doc.text('Mascolo Químicos', 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('FACTURADOR FISCAL Y GESTIÓN DE CLIENTES', 15, 26);

    // Sale info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('COMPROBANTE DE GESTIÓN', 130, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`NRO: ${String(sale.id).padStart(6, '0')}`, 130, 26);
    doc.text(`FECHA: ${new Date(sale.fecha).toLocaleDateString()}`, 130, 32);

    // Client Box
    doc.setDrawColor(230);
    doc.setFillColor(250, 250, 250);
    doc.rect(15, 40, 180, 25, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 20, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sale.client.razon_social || 'S/D'}`, 45, 48);

    doc.setFont('helvetica', 'bold');
    doc.text('CUIT:', 20, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sale.client.cuit || 'S/D'}`, 45, 54);

    doc.setFont('helvetica', 'bold');
    doc.text('DIRECCIÓN:', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sale.client.direccion || 'No especificada'}`, 45, 60);

    // Items Table
    const tableRows = sale.items.map((item: any) => [
      item.product?.nombre || 'Producto Desconocido',
      item.batch_id ? `Lote ID: ${item.batch_id}` : '-',
      `${item.cantidad} UN`,
      `${(item.cantidad * Number(item.product?.peso_kg || 0)).toFixed(2)} KG`,
      `USD ${Number(item.precio_unitario_usd || 0).toFixed(2)}`,
      `USD ${(item.cantidad * Number(item.product?.peso_kg || 0) * Number(item.precio_unitario_usd || 0)).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['PRODUCTO', 'DETALLE', 'CANT', 'TOTAL KG', 'P. UNIT (KG)', 'SUBTOTAL']],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 15, right: 15 },
      styles: { font: 'helvetica', fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 80;

    // Totals
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    const cotizacion = Number(sale.cotizacion_dolar_usada) || 1;
    const totalUsd = Number(sale.total_real_ars) / cotizacion;

    // USD Total Stacked
    doc.text('TOTAL USD:', 195, finalY + 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`USD ${totalUsd.toFixed(2)}`, 195, finalY + 22, { align: 'right' });

    // Cotización Stacked
    doc.setFontSize(9);
    doc.text(`COTIZACIÓN USD: $${cotizacion.toFixed(2)}`, 195, finalY + 30, { align: 'right' });

    // ARS Total Stacked (Main Total)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL ARS:', 195, finalY + 42, { align: 'right' });
    
    doc.setFontSize(16);
    doc.text(`$${Number(sale.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 195, finalY + 52, { align: 'right' });

    // Footer note
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('Este documento es un comprobante de gestión interna y no posee validez como factura fiscal ante ARCA/AFIP.', 15, 280);

    doc.save(`Facturacion_${String(sale.id).padStart(6, '0')}.pdf`);
  } catch (error) {
    console.error('Error generando PDF:', error);
    toast.error('Error al generar el PDF. Revise la consola para más detalles.');
  }
};

export const generateQuotationPDF = (quotation: any) => {
  try {
    if (!quotation || !quotation.client || !quotation.items) {
      toast.error('Error: Datos de cotización incompletos.');
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 85, 17); // #2C5511 (Verde Mascolo)
    doc.text('Mascolo Químicos', 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('FACTURADOR FISCAL Y GESTIÓN DE CLIENTES', 15, 26);

    // Quotation info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('PRESUPUESTO / COTIZACIÓN', 110, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`NRO: ${String(quotation.id).padStart(6, '0')}`, 110, 26);
    doc.text(`FECHA: ${new Date(quotation.fecha).toLocaleDateString()}`, 110, 32);
    doc.text(`VALIDEZ: ${quotation.validez_dias} DÍAS`, 110, 38);

    // Client Box
    doc.setDrawColor(230);
    doc.setFillColor(250, 250, 250);
    doc.rect(15, 45, 180, 25, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 20, 53);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quotation.client.razon_social || 'S/D'}`, 45, 53);

    doc.setFont('helvetica', 'bold');
    doc.text('CUIT:', 20, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quotation.client.cuit || 'S/D'}`, 45, 59);

    doc.setFont('helvetica', 'bold');
    doc.text('DIRECCIÓN:', 20, 65);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quotation.client.direccion || 'No especificada'}`, 45, 65);

    // Items Table
    const tableRows = quotation.items.map((item: any) => [
      item.product?.nombre || 'Producto Desconocido',
      `${item.cantidad} UN`,
      `${(item.cantidad * Number(item.product?.peso_kg || 0)).toFixed(2)} KG`,
      `USD ${Number(item.precio_unitario_usd || 0).toFixed(2)}`,
      `USD ${(item.cantidad * Number(item.product?.peso_kg || 0) * Number(item.precio_unitario_usd || 0)).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['PRODUCTO', 'CANT', 'TOTAL KG', 'P. UNIT (KG)', 'SUBTOTAL']],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 15, right: 15 },
      styles: { font: 'helvetica', fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 85;

    // Totals
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    const cotizacion = Number(quotation.cotizacion_dolar_usada) || 1;
    const totalUsd = Number(quotation.total_real_ars) / cotizacion;

    // USD Total Stacked
    doc.text('TOTAL ESTIMADO USD:', 195, finalY + 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`USD ${totalUsd.toFixed(2)}`, 195, finalY + 22, { align: 'right' });

    // Cotización Stacked
    doc.setFontSize(9);
    doc.text(`COTIZACIÓN USD: $${cotizacion.toFixed(2)}`, 195, finalY + 30, { align: 'right' });

    // ARS Total Stacked (Main Total)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL ESTIMADO ARS:', 195, finalY + 42, { align: 'right' });
    
    doc.setFontSize(16);
    doc.text(`$${Number(quotation.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 195, finalY + 52, { align: 'right' });

    // Footer note
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('Este presupuesto tiene carácter informativo y su validez está sujeta a los días indicados y disponibilidad de stock.', 15, 280);

    doc.save(`Presupuesto_${String(quotation.id).padStart(6, '0')}.pdf`);
  } catch (error) {
    console.error('Error generando PDF:', error);
    toast.error('Error al generar el PDF.');
  }
};

export const generateAccountStatementPDF = (client: any, transactions: any[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFillColor(51, 61, 41); // #333D29
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA', 15, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Mascolo Químicos - Facturador Fiscal', 15, 32);

  // Client Info
  doc.setTextColor(51, 61, 41);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(client.razon_social.toUpperCase(), 15, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`CUIT: ${client.cuit}`, 15, 62);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 15, 67);

  // Balance Summary
  doc.setDrawColor(230, 230, 230);
  doc.line(pageWidth - 85, 50, pageWidth - 15, 50);
  
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE SALDOS', pageWidth - 85, 58);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Saldo en Blanco:', pageWidth - 85, 65);
  doc.text(`$${Number(client.saldo_blanco).toLocaleString('es-AR')}`, pageWidth - 15, 65, { align: 'right' });
  
  doc.text('Saldo Gestión:', pageWidth - 85, 71);
  doc.text(`$${Number(client.saldo_negro).toLocaleString('es-AR')}`, pageWidth - 15, 71, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DEUDA TOTAL:', pageWidth - 85, 80);
  doc.text(`$${Number(client.saldo_deuda).toLocaleString('es-AR')}`, pageWidth - 15, 80, { align: 'right' });

  // Table
  const tableData = transactions.map(t => [
    new Date(t.fecha).toLocaleDateString(),
    t.tipo === 'FACTURACIÓN' ? `FACTURACIÓN #${String(t.id).padStart(5, '0')}` : 'COBRO REGISTRADO',
    t.tipo_comprobante || (t.tipo === 'COBRO' ? t.metodo_pago : '—'),
    t.tipo === 'FACTURACIÓN' ? `$${Number(t.total_real_ars).toLocaleString('es-AR')}` : '—',
    t.tipo === 'COBRO' ? `$${Number(t.monto_ars).toLocaleString('es-AR')}` : '—'
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['FECHA', 'CONCEPTO', 'DETALLE', 'DEBE (+)', 'HABER (-)']],
    body: tableData,
    headStyles: { fillColor: [51, 61, 41], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9 }
  });

  doc.save(`Estado_Cuenta_${client.razon_social.replace(/\s+/g, '_')}.pdf`);
};
