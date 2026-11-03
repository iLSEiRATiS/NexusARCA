import assert from 'node:assert/strict';
import { parseArgNumber, getLocalDateString } from '../frontend/src/utils/format.ts';

console.log('🧪 INICIANDO TEST SUITE: UTILIDADES Y PARSE DE FORMATOS');

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

// ── TEST 1: parseArgNumber con formato argentino ──
test('parseArgNumber maneja separadores de miles y decimales argentinos', () => {
  assert.equal(parseArgNumber('10.000'), 10000);
  assert.equal(parseArgNumber('1.500,50'), 1500.5);
  assert.equal(parseArgNumber('1.000.000,25'), 1000000.25);
  assert.equal(parseArgNumber('0,75'), 0.75);
  assert.equal(parseArgNumber('500'), 500);
  assert.equal(parseArgNumber(1250.75), 1250.75);
});

// ── TEST 2: parseArgNumber con teclado inglés y decimales ──
test('parseArgNumber maneja decimales con punto', () => {
  assert.equal(parseArgNumber('100.50'), 100.5);
  assert.equal(parseArgNumber('0.25'), 0.25);
  assert.equal(parseArgNumber('-0.50'), -0.5);
});

// ── TEST 3: parseArgNumber con valores nulos o vacíos ──
test('parseArgNumber retorna 0 en valores nulos, indefinidos o vacíos', () => {
  assert.equal(parseArgNumber(''), 0);
  assert.equal(parseArgNumber(null), 0);
  assert.equal(parseArgNumber(undefined), 0);
  assert.equal(parseArgNumber('   '), 0);
  assert.equal(parseArgNumber('abc'), 0);
});

// ── TEST 4: getLocalDateString retorna formato YYYY-MM-DD ──
test('getLocalDateString retorna fecha en formato YYYY-MM-DD', () => {
  const dateStr = getLocalDateString(new Date('2026-11-03T15:00:00Z'));
  assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);
});

console.log(`\n📊 RESULTADO DE TESTS FORMATOS: ${passed} pasados, ${failed} fallados.`);
if (failed > 0) process.exit(1);
