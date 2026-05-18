import { ProductService } from '../services/product.service';
import prisma from '../config/prisma';

const products = [
  { nombre: 'Acido Citrico', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Acido Tartarico', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Bicarbonato de Amonio', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Bicarbonato de Sodio', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Carbonato de Calcio Precipitado', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Polvo para Hornear', presentacion: 'Bolsa 20kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Propionato de Calcio', presentacion: 'Bolsa 20kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Cremor Tartaro', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Dextrosa', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Almidon de Maiz', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Fosfato Monocalcico', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Lecitina de Soja', presentacion: 'Tambor 210kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Lecitina de Soja', presentacion: 'Bolsa 20kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Monoestearato de Glicerilo', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
  { nombre: 'Pirofosfato Acido de Sodio', presentacion: 'Bolsa 25kg', precio_usd: 1.0, iva_tasa: 21 },
];

async function seed() {
  console.log('Iniciando carga de productos...');
  
  for (const prod of products) {
    try {
      await ProductService.create({
        ...prod,
        stock_actual: 0,
        stock_minimo: 5
      });
      console.log(`Cargado: ${prod.nombre} (${prod.presentacion})`);
    } catch (error) {
      console.error(`Error cargando ${prod.nombre}:`, error);
    }
  }

  console.log('Carga completada.');
  await prisma.$disconnect();
}

seed();
