import assert from 'node:assert/strict';
import { jsPDF } from '../frontend/node_modules/jspdf';
import autoTable from '../frontend/node_modules/jspdf-autotable';
import QRCode from '../frontend/node_modules/qrcode';

console.log('🧪 INICIANDO TEST SUITE: GENERACIÓN DE PDFS Y CÓDIGOS QR');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✅ PASÓ: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FALLÓ: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function run() {
  // ── TEST 1: Instanciación de jsPDF y autoTable ──
  await test('jsPDF y autoTable se ejecutan sin errores de canvas/entorno', () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.text('Test Factura NexusARCA', 10, 10);
    autoTable(doc, {
      startY: 20,
      head: [['Descripción', 'Cant', 'Precio', 'Total']],
      body: [
        ['Producto Químico A', '100.00 KG', '$1.500,00', '$150.000,00'],
        ['Producto Químico B', '50.00 KG', '$2.000,00', '$100.000,00']
      ]
    });
    const output = doc.output('arraybuffer');
    assert.ok(output.byteLength > 1000, 'El PDF generado debe tener bytes válidos');
  });

  // ── TEST 2: Generación de Código QR Oficial ARCA ──
  await test('Generación de Data URL para QR de Factura ARCA', async () => {
    const qrData = JSON.stringify({
      ver: 1,
      fecha: '2026-11-03',
      cuit: 20106102741,
      ptoVta: 6,
      tipoCmp: 1,
      nroCmp: 38,
      importe: 60500,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 80,
      nroDocRec: 21409318550,
      tipoCodAut: 'E',
      codAut: 86441033142809
    });

    const qrBase64 = Buffer.from(qrData).toString('base64');
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 120 });
    assert.ok(qrDataUrl.startsWith('data:image/png;base64,'), 'Debe generar un Data URL válido');
  });

  console.log(`\n📊 RESULTADO DE TESTS PDF Y QR: ${passed} pasados, ${failed} fallados.`);
  if (failed > 0) process.exit(1);
}

run();
