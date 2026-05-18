import { Router } from 'express';
import { QuotationController } from '../controllers/quotation.controller';
import { validate } from '../middlewares/validate.middleware';
import { createQuotationSchema, updateQuotationStatusSchema } from '../schemas/quotation.schema';

const router = Router();

router.get('/', QuotationController.getAll);
router.get('/:id', QuotationController.getById);
router.post('/', validate(createQuotationSchema), QuotationController.create);
router.patch('/:id/status', validate(updateQuotationStatusSchema), QuotationController.updateStatus);
router.delete('/:id', QuotationController.delete);
router.post('/:id/convert', QuotationController.convertToSale);

export default router;
