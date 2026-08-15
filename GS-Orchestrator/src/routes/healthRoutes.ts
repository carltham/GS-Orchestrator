import { Request, Response, Router } from 'express';
import { RegistryService } from '../services/RegistryService';
import { SystemConfigService } from '../services/SystemConfigService';

export function createHealthRoutes(registry: RegistryService, port: number): Router {
  const router = Router();
  const sysConfig = SystemConfigService.getInstance();

  // GET /reports/health
  router.get('/reports/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      port,
    });
  });

  // GET /orch/reporting/health
  router.get('/orch/reporting/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // POST /orch/reporting/project/health
  router.post('/orch/reporting/project/health', (req: Request, res: Response) => {
    try {
      const { projectName, health } = req.body;

      if (!projectName) {
        return res.status(400).json({
          error: sysConfig.formatError('missingHealthProjectName'),
        });
      }

      const projectEntry = registry.getProject(projectName);
      if (!projectEntry) {
        console.warn(`⚠️ Health report from unregistered project "${projectName}"`);
        return res.status(404).json({
          error: sysConfig.formatError('healthProjectNotFound', { projectName }),
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
        error: sysConfig.formatError('healthReportFailed'),
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
