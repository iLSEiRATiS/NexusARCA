import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { validate } from '../middlewares/validate.middleware';
import { createSaleSchema } from '../schemas/sale.schema';

const router = Router();

router.get('/', SaleController.getAll);
router.get('/:id', SaleController.getById);
router.post('/', validate(createSaleSchema), SaleController.create);
router.post('/:id/bill', SaleController.billSale);

export default router;
