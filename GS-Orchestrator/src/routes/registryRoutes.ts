import { Request, Response, Router } from 'express';
import { RegistryService } from '../services/RegistryService';

export function createRegistryRoutes(registry: RegistryService): Router {
  const router = Router();

  // GET /api/registry
  router.get('/api/registry', (req: Request, res: Response) => {
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
