import { AfipService } from './services/afip.service';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function testConnection() {
  console.log('--- TEST DE CONEXIÓN ARCA (AFIP) ---');
  console.log('CUIT:', process.env.AFIP_CUIT);
  console.log('Modo:', process.env.NODE_ENV);
  
  try {
    console.log('\nSolicitando tipos de comprobantes...');
    const voucherTypes = await AfipService.getVoucherTypes();
    console.log('✅ Conexión exitosa!');
    console.log('Se obtuvieron', voucherTypes.length, 'tipos de comprobantes.');
    
    console.log('\nSolicitando tipos de documentos...');
    const docTypes = await AfipService.getDocumentTypes();
    console.log('✅ Tipos de documentos obtenidos:', docTypes.length);
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error de conexión:');
    console.error(error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
    if (error.message.includes('cert.crt')) {
      console.log('\nSugerencia: Verificá que el archivo cert.crt esté en backend/afip_res/');
    }
    process.exit(1);
  }
}

testConnection();
