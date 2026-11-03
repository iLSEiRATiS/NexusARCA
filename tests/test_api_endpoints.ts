import assert from 'node:assert/strict';

console.log('🧪 INICIANDO TEST SUITE: ENDPOINTS HTTP (API LIVE)');

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
  const BASE_URL = 'http://localhost:3000/api';
  let token = '';

  // ── TEST 1: Health / Status ──
  await test('GET /health responde status online', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'online');
    assert.equal(data.project, 'Máscolo Facturador');
  });

  // ── TEST 2: Login de Usuario para Obtener Token ──
  await test('POST /auth/login autentica y retorna token JWT', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token, 'Debe retornar un token JWT');
    token = data.token;
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // ── TEST 3: Currency / Dólar Oficial ──
  await test('GET /currency/dolar-oficial retorna cotización válida (Autenticado)', async () => {
    const res = await fetch(`${BASE_URL}/currency/dolar-oficial`, { headers: authHeaders });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Number(data.cotizacion) > 0, 'La cotización debe ser mayor a 0');
  });

  // ── TEST 4: Clients List ──
  await test('GET /clients retorna lista de clientes (Autenticado)', async () => {
    const res = await fetch(`${BASE_URL}/clients`, { headers: authHeaders });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Debe retornar un array');
  });

  // ── TEST 5: Client by ID ──
  await test('GET /clients/:id retorna detalle completo con sales y payments (Autenticado)', async () => {
    const resList = await fetch(`${BASE_URL}/clients`, { headers: authHeaders });
    const clients = await resList.json();
    if (clients.length > 0) {
      const clientId = clients[0].id;
      const res = await fetch(`${BASE_URL}/clients/${clientId}`, { headers: authHeaders });
      assert.equal(res.status, 200);
      const client = await res.json();
      assert.equal(client.id, clientId);
      assert.ok(Array.isArray(client.sales), 'sales debe ser un array');
      assert.ok(Array.isArray(client.payments), 'payments debe ser un array');
    }
  });

  // ── TEST 6: Sales List (Paginada) ──
  await test('GET /sales retorna paginación con lista de ventas (Autenticado)', async () => {
    const res = await fetch(`${BASE_URL}/sales`, { headers: authHeaders });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.data), 'data.data debe ser un array');
    assert.ok(typeof data.meta?.total === 'number', 'data.meta.total debe ser numérico');
  });

  // ── TEST 7: Quotations List (Paginada) ──
  await test('GET /quotations retorna paginación con lista de presupuestos (Autenticado)', async () => {
    const res = await fetch(`${BASE_URL}/quotations`, { headers: authHeaders });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.data), 'data.data debe ser un array');
    assert.ok(typeof data.meta?.total === 'number', 'data.meta.total debe ser numérico');
  });

  // ── TEST 8: Config Settings ──
  await test('GET /config retorna configuración del sistema (Autenticado)', async () => {
    const res = await fetch(`${BASE_URL}/config`, { headers: authHeaders });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.punto_venta !== undefined || data.modo_produccion !== undefined);
  });

  // ── TEST 9: Protección de Rutas sin Token ──
  await test('Rutas protegidas rechazan peticiones sin token (401)', async () => {
    const res = await fetch(`${BASE_URL}/sales`); // Sin Authorization header
    assert.equal(res.status, 401, 'Debe responder con 401 Unauthorized');
  });

  console.log(`\n📊 RESULTADO DE TESTS ENDPOINTS HTTP: ${passed} pasados, ${failed} fallados.`);
  if (failed > 0) process.exit(1);
}

run();
