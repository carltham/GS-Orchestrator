import { Request, Response, Router } from 'express';
import { RegistryService } from '../services/RegistryService';
import { ServerScannerService } from '../services/ServerScannerService';

export function createRegistryRoutes(
  registry: RegistryService,
  serverScanner?: ServerScannerService
): Router {
  const router = Router();

  // GET /api/registry
  router.get('/api/registry', async (req: Request, res: Response) => {
    if (serverScanner) {
      await serverScanner.scanRunningServers().catch(() => {});
    }
    const data = registry.getState();
    res.status(200).json(data);
  });

  // GET /api/count
  router.get('/api/count', (req: Request, res: Response) => {
    const count = registry.getProjectCount();
    res.status(200).json({ count });
  });

  return router;
}
