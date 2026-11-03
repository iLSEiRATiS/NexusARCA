import assert from 'node:assert/strict';
import { processClientLedger, getDocumentClassification } from '../frontend/src/utils/accountLedger.ts';

console.log('🧪 INICIANDO TEST SUITE: MOTOR CONTABLE (accountLedger.ts)');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASÓ: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FALLÓ: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ── TEST 1: Cliente sin deuda (saldo_blanco = 0, saldo_interno = 0) ──
test('Cliente sin deuda no debe tener facturas pendientes', () => {
  const client = { id: 1, saldo_blanco: 0, saldo_interno: 0, saldo_deuda: 0 };
  const clientDetails = {
    sales: [
      { id: 101, tipo_comprobante: 'Factura A', nro_comprobante: '00000001', total_real_ars: 10000, tipo: 'BLANCO', fecha: '2026-11-01' }
    ],
    payments: [
      { id: 201, tipo: 'BLANCO', metodo_pago: 'EFECTIVO', monto_ars: 10000, referencia: 'Cobro Factura A N° 00000001', fecha: '2026-11-02' }
    ]
  };

  const ledger = processClientLedger(client, clientDetails);
  assert.equal(ledger.pendingDebts.length, 0, 'No debe haber deudas pendientes');
  assert.equal(ledger.paidDebts.length, 1, 'Debe haber 1 deuda en pagados');
  assert.equal(ledger.paidDebts[0].isPaid, true);
});

// ── TEST 2: Cliente con factura impaga (saldo_blanco = -10000) ──
test('Factura impaga permanece en deudas pendientes con su monto total', () => {
  const client = { id: 1, saldo_blanco: -10000, saldo_interno: 0, saldo_deuda: -10000 };
  const clientDetails = {
    sales: [
      { id: 102, tipo_comprobante: 'Factura A', nro_comprobante: '00000002', total_real_ars: 10000, tipo: 'BLANCO', fecha: '2026-11-01' }
    ],
    payments: []
  };

  const ledger = processClientLedger(client, clientDetails);
  assert.equal(ledger.pendingDebts.length, 1);
  assert.equal(ledger.pendingDebts[0].saldoPendiente, 10000);
  assert.equal(ledger.pendingDebts[0].isPartial, false);
});

// ── TEST 3: Pago parcial con método SALDO_A_FAVOR ──
test('Pago parcial con saldo a favor mantiene la factura con el remanente exacto', () => {
  const client = { id: 1, saldo_blanco: -8000, saldo_interno: 0, saldo_deuda: -8000 };
  const clientDetails = {
    sales: [
      { id: 103, tipo_comprobante: 'Factura A', nro_comprobante: '00000003', total_real_ars: 10000, tipo: 'BLANCO', fecha: '2026-11-01' }
    ],
    payments: [
      { id: 202, tipo: 'BLANCO', metodo_pago: 'SALDO_A_FAVOR', monto_ars: 2000, referencia: 'Factura A N° 00000003 (Saldo a Favor)', fecha: '2026-11-02' }
    ]
  };

  const ledger = processClientLedger(client, clientDetails);
  assert.equal(ledger.pendingDebts.length, 1);
  const pending = ledger.pendingDebts[0];
  assert.equal(pending.saldoPendiente, 8000, 'El saldo pendiente debe ser 8000');
  assert.equal(pending.totalPagado, 2000, 'El total pagado debe ser 2000');
  assert.equal(pending.isPartial, true, 'Debe marcarse como parcial');
});

// ── TEST 4: Aislamiento por sectores (Fiscal vs Interno) ──
test('Aislamiento sectorial: cobrar remito interno no afecta factura fiscal', () => {
  const client = { id: 1, saldo_blanco: -10000, saldo_interno: 0, saldo_deuda: -10000 };
  const clientDetails = {
    sales: [
      { id: 104, tipo_comprobante: 'Factura A', nro_comprobante: '00000004', total_real_ars: 10000, tipo: 'BLANCO', fecha: '2026-11-01' },
      { id: 105, tipo_comprobante: 'Remito', nro_comprobante: 'REM-105', total_real_ars: 5000, tipo: 'INTERNO', fecha: '2026-11-01' }
    ],
    payments: [
      { id: 203, tipo: 'INTERNO', metodo_pago: 'EFECTIVO', monto_ars: 5000, referencia: 'Cobro Remito Interno N° REM-105', fecha: '2026-11-02' }
    ]
  };

  const ledger = processClientLedger(client, clientDetails);
  assert.equal(ledger.pendingDebts.length, 1, 'Solo debe quedar pendiente la factura fiscal');
  assert.equal(ledger.pendingDebts[0].tipo, 'BLANCO');
  assert.equal(ledger.pendingDebts[0].saldoPendiente, 10000);
});

// ── TEST 5: Reconciliación con saldo real del cliente (tope de deuda contable) ──
test('Reconciliación: comprobantes anteriores ya amortizados pasan a Pagados', () => {
  // El cliente debe $4.840 en total según saldo_blanco
  const client = { id: 1, saldo_blanco: -4840, saldo_interno: 0, saldo_deuda: -4840 };
  const clientDetails = {
    sales: [
      { id: 106, tipo_comprobante: 'Factura A', nro_comprobante: '00000005', total_real_ars: 60500, tipo: 'BLANCO', fecha: '2026-10-30' },
      { id: 107, tipo_comprobante: 'Factura A', nro_comprobante: '00000006', total_real_ars: 4840, tipo: 'BLANCO', fecha: '2026-11-03' }
    ],
    payments: [
      { id: 204, tipo: 'BLANCO', metodo_pago: 'SALDO_A_FAVOR', monto_ars: 10000, referencia: 'Factura A N° 00000005 (Saldo a Favor)', fecha: '2026-11-01' },
      { id: 205, tipo: 'BLANCO', metodo_pago: 'SALDO_A_FAVOR', monto_ars: 29500, referencia: 'Factura A N° 00000005 (Saldo a Favor)', fecha: '2026-11-02' }
    ]
  };

  const ledger = processClientLedger(client, clientDetails);
  // La factura anterior 00000005 no debe quedar en pendingDebts porque el saldo_blanco real es solo $4.840
  assert.equal(ledger.pendingDebts.length, 1, 'Solo debe quedar pendiente la factura activa actual');
  assert.equal(ledger.pendingDebts[0].id, 'sale-107');
  assert.equal(ledger.pendingDebts[0].saldoPendiente, 4840);
});

// ── TEST 6: Cliente con saldo a favor positivo sin ventas no crea deudas fantasmas ──
test('Cliente con saldo a favor positivo no genera deudas de respaldo ficticias', () => {
  const client = { id: 1, saldo_blanco: 5000, saldo_interno: 0, saldo_deuda: 5000, saldo_a_favor: 5000 };
  const clientDetails = { sales: [], payments: [] };

  const ledger = processClientLedger(client, clientDetails);
  assert.equal(ledger.pendingDebts.length, 0, 'No debe generar deuda pendiente si el saldo es positivo');
});

// ── TEST 7: Clasificación de documentos y títulos de comprobantes ──
test('getDocumentClassification asigna títulos y caracteres precisos', () => {
  const factura = { type: 'venta', tipo_comprobante: 'Factura A', nro_comprobante: '00000038', cae: '12345' };
  const remito = { type: 'venta', tipo_comprobante: 'Remito', nro_comprobante: 'REM-60' };
  const pagoFavor = { type: 'cobro', tipo: 'A_FAVOR', referencia: 'Carga de Saldo a Favor [Fiscal]' };

  assert.equal(getDocumentClassification(factura).caracter, 'FISCAL');
  assert.equal(getDocumentClassification(remito).caracter, 'INTERNO');
  assert.equal(getDocumentClassification(pagoFavor).caracter, 'FAVOR');
});

console.log(`\n📊 RESULTADO DE TESTS MOTOR CONTABLE: ${passed} pasados, ${failed} fallados.`);
if (failed > 0) process.exit(1);
