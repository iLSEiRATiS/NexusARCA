import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { validateSchema } from '../middlewares/validate.middleware';
import { createProductSchema, updateProductSchema, adjustStockSchema } from '../schemas/product.schema';

const router = Router();

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);

// Aplicando middleware de validación a las rutas de mutación
router.post('/', validateSchema(createProductSchema), ProductController.create);
router.put('/:id', validateSchema(updateProductSchema), ProductController.update);
router.delete('/:id', ProductController.delete);

router.post('/:id/stock', validateSchema(adjustStockSchema), ProductController.adjustStock);

// Rutas de Lotes
router.patch('/batches/:batchId', ProductController.updateBatch);
router.delete('/batches/:batchId', ProductController.deleteBatch);

export default router;
