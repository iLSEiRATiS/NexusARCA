import { execSync } from 'child_process';

console.log('====================================================');
console.log('🚀 NEXUS ARCA - SUITE COMPLETA DE PRUEBAS DE ERRORES');
console.log('====================================================\n');

const testSuites = [
  { name: '1. Motor Contable y Cuenta Corriente (accountLedger)', file: 'tests/test_ledger.ts' },
  { name: '2. Servicios Backend y Base de Datos Prisma', file: 'tests/test_backend_services.ts' },
  { name: '3. Utilidades y Formatos Numéricos es-AR', file: 'tests/test_format.ts' },
  { name: '4. Endpoints HTTP y Seguridad JWT (API Live)', file: 'tests/test_api_endpoints.ts' },
  { name: '5. Generación de PDFs y Códigos QR ARCA', file: 'tests/test_pdf.ts' },
];

let allPassed = true;

for (const suite of testSuites) {
  console.log(`\n▶ Ejecutando ${suite.name}...`);
  try {
    const output = execSync(`npx --yes tsx ${suite.file}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: process.cwd()
    });
    console.log(output.trim());
  } catch (err: any) {
    allPassed = false;
    console.error(`❌ Falló la suite: ${suite.name}`);
    console.error(err.stdout || err.stderr || err.message);
  }
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 TODAS LAS SUITES DE PRUEBA PASARON EXITOSAMENTE (0 ERRORES)');
} else {
  console.log('⚠️ SE ENCONTRARON ERRORES EN LAS PRUEBAS');
  process.exit(1);
}
console.log('====================================================\n');
