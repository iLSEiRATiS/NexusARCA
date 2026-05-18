import { Router } from 'express';
import { CurrencyController } from '../controllers/currency.controller';

const router = Router();

router.get('/dolar-oficial', CurrencyController.getDolarRate);

export default router;
