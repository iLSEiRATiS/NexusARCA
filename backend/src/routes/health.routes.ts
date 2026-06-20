import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    project: 'Mascolo Facturador',
    timestamp: new Date().toISOString()
  });
});

export default router;
