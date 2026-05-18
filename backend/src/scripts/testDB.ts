import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    const clients = await prisma.client.findMany();
    console.log('Clientes:', clients);
  } catch (error) {
    console.error('Error connecting to DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
