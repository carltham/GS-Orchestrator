import { Request, Response, Router } from 'express';
import { ServerScannerService } from '../services/ServerScannerService';

export function createScannerRoutes(serverScanner: ServerScannerService): Router {
  const router = Router();

  // GET /api/unregistered
  router.get('/api/unregistered', (req: Request, res: Response) => {
    const data = serverScanner.loadData();
    res.status(200).json(data);
  });

  return router;
}
