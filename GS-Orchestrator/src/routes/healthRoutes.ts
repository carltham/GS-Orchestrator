import { Request, Response, Router } from 'express';
import { RegistryService } from '../services/RegistryService';

export function createHealthRoutes(registry: RegistryService, port: number): Router {
  const router = Router();

  // GET /health
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      port,
    });
  });

  // GET /api/health
  router.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // POST /api/health
  router.post('/api/health', (req: Request, res: Response) => {
    try {
      const { projectName, health } = req.body;

      if (!projectName) {
        return res.status(400).json({
          error: 'Missing required field: projectName',
        });
      }

      const projectEntry = registry.getProject(projectName);
      if (!projectEntry) {
        console.warn(`⚠️ Health report from unregistered project "${projectName}"`);
        return res.status(404).json({
          error: `Project "${projectName}" not found`,
        });
      }

      if (health) {
        projectEntry.status = health.status === 'ok' ? 'running' : 'stopped';
      }

      console.log(`💓 Health report from "${projectName}": ${health?.status || 'unknown'} (uptime: ${health?.uptimeSeconds}s)`);

      res.status(200).json({
        received: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Health report error:', error);
      res.status(500).json({
        error: 'Failed to process health report',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
