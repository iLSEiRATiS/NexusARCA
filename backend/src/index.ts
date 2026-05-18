import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import healthRoutes from './routes/health.routes';
import userRoutes from './routes/user.routes';
import productRoutes from './routes/product.routes';
import currencyRoutes from './routes/currency.routes';
import clientRoutes from './routes/client.routes';
import saleRoutes from './routes/sale.routes';
import quotationRoutes from './routes/quotation.routes';
import { errorHandler } from './middlewares/error.middleware';
import { protect } from './middlewares/auth.middleware';
import { UserService } from './services/user.service';

// Cargar variables de entorno
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Rate Limiting (Prevención de ataques de fuerza bruta)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP
  message: 'Demasiadas peticiones desde esta IP, intente de nuevo más tarde.'
});
app.use('/api/', limiter);

// Rutas Públicas
app.use('/api', healthRoutes);
app.use('/api/auth', userRoutes);

// Rutas Protegidas (Requieren Login)
app.use('/api/products', protect, productRoutes);
app.use('/api/currency', protect, currencyRoutes);
app.use('/api/clients', protect, clientRoutes);
app.use('/api/sales', protect, saleRoutes);
app.use('/api/quotations', protect, quotationRoutes);

// Manejo global de errores
app.use(errorHandler);

// Servidor e inicialización de seguridad
app.listen(PORT, async () => {
  console.log(`🚀 EnGroncho Backend ejecutándose en puerto ${PORT}`);
  // Crear admin inicial si no existe
  await UserService.createInitialAdmin();
});
