import { Router } from 'express';
import { ImportController } from '../controllers/import.controller';

const router = Router();

router.post('/csv', ImportController.importSaleCSV);

export default router;
