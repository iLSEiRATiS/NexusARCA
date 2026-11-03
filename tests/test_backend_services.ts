import assert from 'node:assert/strict';
import prisma from '../backend/src/config/prisma';
import { ClientService } from '../backend/src/services/client.service';
import { AppError } from '../backend/src/utils/AppError';

console.log('🧪 INICIANDO TEST SUITE: BACKEND SERVICES & PRISMA ORM');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
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
  const TEST_CUIT = '99999999991';
  let createdClientId: number | null = null;

  // Limpieza inicial por si quedó un test previo
  const existing = await ClientService.getByCuit(TEST_CUIT);
  if (existing) {
    await ClientService.delete(existing.id);
  }

  // ── TEST 1: Creación de Cliente y Saneamiento de CUIT ──
  await test('Creación de cliente y saneamiento de CUIT con guiones', async () => {
    const client = await ClientService.create({
      razon_social: 'EMPRESA TEST AUTOMATIZADO S.A.',
      cuit: '99-99999999-1', // CUIT con guiones
      condicion_iva: 'RESPONSABLE_INSCRIPTO',
      saldo_blanco: -10000,
      saldo_interno: -5000,
      saldo_a_favor_blanco: 0,
      saldo_a_favor_interno: 0,
    });

    createdClientId = client.id;
    assert.equal(client.cuit, TEST_CUIT, 'El CUIT debe quedar sanitizado sin guiones');
    assert.equal(Number(client.saldo_deuda), -15000, 'La deuda total consolidada debe ser -15000');
  });

  if (!createdClientId) {
    console.error('No se pudo crear el cliente de prueba. Abortando tests.');
    process.exit(1);
  }

  // ── TEST 2: Carga de Saldo a Favor Modo 'add' ──
  await test('Carga de saldo a favor suma correctamente al saldo del sector', async () => {
    // Cargar $3.000 fiscal
    const updated = await ClientService.loadCredit(
      createdClientId!,
      3000,
      'BLANCO',
      'Test Carga Saldo Fiscal',
      undefined,
      'TRANSFERENCIA',
      'add'
    );

    assert.equal(Number(updated.saldo_a_favor_blanco), 3000, 'Saldo a favor blanco debe ser 3000');
    assert.equal(Number(updated.saldo_a_favor), 3000, 'Saldo a favor total debe ser 3000');
    assert.equal(Number(updated.saldo_a_favor_interno), 0, 'Saldo a favor interno debe ser 0');
  });

  // ── TEST 3: Carga de Saldo a Favor Rechaza Montos Negativos ──
  await test('Carga de saldo a favor en modo add rechaza montos negativos o 0', async () => {
    let errorCaught = false;
    try {
      await ClientService.loadCredit(createdClientId!, -500, 'BLANCO', 'Invalido', undefined, 'EFECTIVO', 'add');
    } catch (err: any) {
      errorCaught = true;
      assert.equal(err.statusCode, 400);
    }
    assert.equal(errorCaught, true, 'Debe arrojar AppError con status 400');
  });

  // ── TEST 4: Imputación a Deuda Rechaza si el Monto Supera el Saldo a Favor ──
  await test('Imputación rechaza si se intenta imputar más que el saldo a favor disponible', async () => {
    let errorCaught = false;
    try {
      // Tiene 3000, intenta imputar 10000
      await ClientService.loadCredit(
        createdClientId!,
        10000,
        'BLANCO',
        'Imputar más de lo que tiene',
        undefined,
        'SALDO_A_FAVOR',
        'add',
        {
          imputar_a_deuda: true,
          deuda_referencia: 'Factura A N° 0001-00000001',
          deuda_monto: 10000
        }
      );
    } catch (err: any) {
      errorCaught = true;
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('supera el saldo a favor'));
    }
    assert.equal(errorCaught, true, 'Debe arrojar AppError 400 al intentar imputar más de lo disponible');
  });

  // ── TEST 5: Imputación Exitosa Amortiza Deuda y Deduce Saldo a Favor ──
  await test('Imputación exitosa deduce crédito y reduce deuda contable', async () => {
    // Cliente tiene saldo a favor de $3.000 y deuda fiscal de -$10.000.
    // Imputamos $2.000 a la deuda:
    const updated = await ClientService.loadCredit(
      createdClientId!,
      2000,
      'BLANCO',
      'Cobro Factura A N° 0001-00000001 (Imputación Saldo a Favor)',
      undefined,
      'SALDO_A_FAVOR',
      'add',
      {
        imputar_a_deuda: true,
        deuda_referencia: 'Factura A N° 0001-00000001',
        deuda_monto: 10000
      }
    );

    assert.equal(Number(updated.saldo_a_favor_blanco), 1000, 'Saldo a favor blanco debe reducirse a 1000');
    assert.equal(Number(updated.saldo_blanco), -8000, 'Deuda fiscal debe reducirse a -8000');
    assert.equal(Number(updated.saldo_deuda), -13000, 'Deuda consolidada debe ser -13000 (-8000 + -5000)');

    // Verificar que se creó el registro de pago con método SALDO_A_FAVOR
    const payments = await prisma.payment.findMany({
      where: { client_id: createdClientId!, metodo_pago: 'SALDO_A_FAVOR', tipo: 'BLANCO' }
    });
    assert.ok(payments.length >= 1, 'Debe existir un pago de método SALDO_A_FAVOR');
    const lastPay = payments[payments.length - 1];
    assert.equal(Number(lastPay.monto_ars), 2000, 'El monto del pago debe ser exactamente 2000');
  });

  // ── TEST 6: Cobro Directo con Método SALDO_A_FAVOR (registerPayment) ──
  await test('registerPayment con método SALDO_A_FAVOR descuenta crédito del sector', async () => {
    // Le queda $1.000 en blanco. Registramos pago de $1.000 con SALDO_A_FAVOR
    const payment = await ClientService.registerPayment(
      createdClientId!,
      1000,
      'BLANCO',
      'SALDO_A_FAVOR',
      'Cobro Factura A N° 0001-00000001 (Segunda cuota)'
    );

    assert.ok(payment.id > 0);

    const client = await ClientService.getById(createdClientId!);
    assert.equal(Number(client?.saldo_a_favor_blanco), 0, 'Crédito fiscal debe quedar en 0');
    assert.equal(Number(client?.saldo_blanco), -7000, 'Deuda fiscal debe ser -7000');
  });

  // ── TEST 7: Reversibilidad de Pago con SALDO_A_FAVOR (deletePayment) ──
  await test('deletePayment de un pago con SALDO_A_FAVOR restaura el crédito al cliente', async () => {
    // Buscamos el último pago de $1.000 hecho con SALDO_A_FAVOR
    const payments = await prisma.payment.findMany({
      where: { client_id: createdClientId!, metodo_pago: 'SALDO_A_FAVOR' },
      orderBy: { id: 'desc' }
    });
    const payToDelete = payments[0];

    await ClientService.deletePayment(createdClientId!, payToDelete.id);

    const client = await ClientService.getById(createdClientId!);
    assert.equal(Number(client?.saldo_a_favor_blanco), 1000, 'El crédito fiscal debe restaurarse a 1000');
    assert.equal(Number(client?.saldo_blanco), -8000, 'La deuda fiscal debe volver a -8000');
  });

  // ── TEST 8: Actualización de Campos Opcionales ──
  await test('Actualización convierte cadenas vacías en null', async () => {
    const updated = await ClientService.update(createdClientId!, {
      email: '',
      telefono: '',
      direccion: '',
      nro_iibb: ''
    });

    assert.equal(updated.email, null);
    assert.equal(updated.telefono, null);
    assert.equal(updated.direccion, null);
    assert.equal(updated.nro_iibb, null);
  });

  // ── LIMPIEZA FINAL ──
  if (createdClientId) {
    await prisma.payment.deleteMany({ where: { client_id: createdClientId } });
    await ClientService.delete(createdClientId);
    console.log('  🧹 Cliente y pagos de prueba eliminados correctamente');
  }

  console.log(`\n📊 RESULTADO DE TESTS BACKEND SERVICES: ${passed} pasados, ${failed} fallados.`);
  if (failed > 0) process.exit(1);
}

run()
  .catch((e) => {
    console.error('Error fatal en ejecución de tests backend:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
