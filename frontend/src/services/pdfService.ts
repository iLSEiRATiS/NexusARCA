import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  doc.text('NexusARCA - Gestión Industrial', 15, 32);

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
  
  doc.text('Saldo EnGroncho:', pageWidth - 85, 71);
  doc.text(`$${Number(client.saldo_negro).toLocaleString('es-AR')}`, pageWidth - 15, 71, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DEUDA TOTAL:', pageWidth - 85, 80);
  doc.text(`$${Number(client.saldo_deuda).toLocaleString('es-AR')}`, pageWidth - 15, 80, { align: 'right' });

  // Table
  const tableData = transactions.map(t => [
    new Date(t.fecha).toLocaleDateString(),
    t.tipo === 'VENTA' ? `VENTA #${String(t.id).padStart(5, '0')}` : 'COBRO REGISTRADO',
    t.tipo_comprobante || (t.tipo === 'COBRO' ? t.metodo_pago : '—'),
    t.tipo === 'VENTA' ? `$${Number(t.total_real_ars).toLocaleString('es-AR')}` : '—',
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
