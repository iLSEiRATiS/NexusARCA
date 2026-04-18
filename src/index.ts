import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.routes';
import productRoutes from './routes/product.routes';

// Cargar variables de entorno
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Rutas
app.use('/api', healthRoutes);
app.use('/api/products', productRoutes);

// Servidor
app.listen(PORT, () => {
  console.log(`🚀 NexusArca Backend ejecutándose en puerto ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
});
