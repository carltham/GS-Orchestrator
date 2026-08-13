import { Request, Response, Router } from 'express';
import { RegistryService } from '../services/RegistryService';
import { ServerScannerService } from '../services/ServerScannerService';

export function createRegistryRoutes(
  registry: RegistryService,
  serverScanner?: ServerScannerService
): Router {
  const router = Router();

  // GET /orch/project/registry
  router.get('/orch/project/registry', async (req: Request, res: Response) => {
    if (serverScanner) {
      await serverScanner.scanRunningServers().catch(() => {});
    }

    // Attempt to pull master registry directly from Process Server (:9999)
    try {
      const psRes = await fetch('http://localhost:9999/ps/project/list');
      if (psRes.ok) {
        const psData = (await psRes.json()) as any;
        if (psData && psData.projects) {
          const remoteRegistry = {
            projects: psData.projects,
            nextPortBase: 4200,
            lastUpdated: new Date().toISOString()
          };
          return res.status(200).json(remoteRegistry);
        }
      }
    } catch {
      // Fall back to local registry state if Process Server is offline / in standalone mode
    }

    const data = registry.getState();
    res.status(200).json(data);
  });

  // GET /orch/project/count
  router.get('/orch/project/count', async (req: Request, res: Response) => {
    try {
      const psRes = await fetch('http://localhost:9999/ps/project/list');
      if (psRes.ok) {
        const psData = (await psRes.json()) as any;
        if (psData && psData.projects) {
          return res.status(200).json({ count: Object.keys(psData.projects).length });
        }
      }
    } catch {
      // Fallback
    }

    const count = registry.getProjectCount();
    res.status(200).json({ count });
  });

  return router;
}
