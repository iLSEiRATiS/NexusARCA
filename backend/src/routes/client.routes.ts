import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import { validate } from '../middlewares/validate.middleware';
import { createClientSchema, updateClientSchema } from '../schemas/client.schema';

const router = Router();

router.get('/', ClientController.getAll);
router.get('/:id', ClientController.getById);
router.post('/', validate(createClientSchema), ClientController.create);
router.patch('/:id', validate(updateClientSchema), ClientController.update);
router.delete('/:id', ClientController.delete);

router.post('/:id/payments', ClientController.registerPayment);
router.post('/sync-all', ClientController.syncAll);

export default router;
