import * as crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { PortAllocatorService } from '../services/PortAllocatorService';
import { RegistryService } from '../services/RegistryService';
import { ServerScannerService } from '../services/ServerScannerService';
import { signalService } from '../services/SignalService';

export function createRegistrationRoutes(
  registry: RegistryService,
  portAllocator: PortAllocatorService,
  serverScanner: ServerScannerService,
  selfProjectName: string
): Router {
  const router = Router();

  // DELETE /api/register/:projectName
  router.delete('/api/register/:projectName', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: 'Missing required parameter: projectName',
        });
      }

      // Update project status to 'stopping'
      const project = registry.getProject(projectName);
      if (project) {
        project.status = 'stopping';
        registry.updateProject(projectName, project);
      }

      // Queue a stop signal for the client
      signalService.queueSignal('stop', projectName);

      if (project) {
        console.log(`🛑 Project "${projectName}" status changed to stopping. Stop signal queued for client.`);
        return res.json({
          message: `Project "${projectName}" is stopping. Stop signal queued for client.`,
          projectName,
          status: 'stopping',
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(404).json({
          error: `Project "${projectName}" not found in registry`,
        });
      }
    } catch (error) {
      console.error('Unregistration error:', error);
      res.status(500).json({
        error: 'Failed to unregister project',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/register/:projectName/stopped
  // Mark a project as stopped and remove from registry
  router.post('/api/register/:projectName/stopped', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: 'Missing required parameter: projectName',
        });
      }

      const success = registry.unregisterProject(projectName);

      if (success) {
        console.log(`✅ Project "${projectName}" stopped and removed from registry`);
        return res.json({
          message: `Project "${projectName}" has been stopped and removed from registry`,
          projectName,
          status: 'stopped',
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(404).json({
          error: `Project "${projectName}" not found in registry`,
        });
      }
    } catch (error) {
      console.error('Stop confirmation error:', error);
      res.status(500).json({
        error: 'Failed to confirm project stopped',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/register
  router.post('/api/register', async (req: Request, res: Response) => {
    try {
      await serverScanner.scanRunningServers().catch(() => {});

      const projectName = req.body.projectName || req.body.project;
      const projectPath = req.body.path;

      if (!projectName || !projectPath) {
        return res.status(400).json({
          error: 'Missing required fields: projectName, path',
        });
      }

      const existing = registry.getProject(projectName);
      if (existing) {
        console.log(`✅ Project "${projectName}" already registered, returning existing components`);

        const ports: Record<string, number> = {};
        for (const [compKey, allocatedPort] of Object.entries(existing.components)) {
          const serviceKey = compKey.split('::')[0];
          ports[serviceKey] = allocatedPort;
        }

        return res.json({
          ports,
          components: existing.components,
          ticket: existing.ticket,
          timestamp: existing.registeredAt,
        });
      }

      const serviceTypes: Record<string, string> = req.body.serviceTypes || {};
      const basePorts: Record<string, number> = req.body.basePorts || {};

      if (Object.keys(serviceTypes).length === 0) {
        if (req.body.backendType) serviceTypes.backend = req.body.backendType;
        if (req.body.frontendType) serviceTypes.frontend = req.body.frontendType;
        if (req.body.databaseType) serviceTypes.database = req.body.databaseType;
        if (Object.keys(serviceTypes).length === 0) {
          serviceTypes.backend = 'node-ts';
        }
      }

      const ports: Record<string, number> = {};
      const components: Record<string, number> = {};

      if (projectName === selfProjectName) {
        ports['backend'] = 9000;
        components['backend::node-ts'] = 9000;
        for (const [serviceKey, serverType] of Object.entries(serviceTypes)) {
          if (serviceKey !== 'backend') {
            const customBase = basePorts[serviceKey];
            const allocatedPort = portAllocator.allocatePort(
              projectName,
              serviceKey,
              serverType,
              customBase
            );
            ports[serviceKey] = allocatedPort;
            components[`${serviceKey}::${serverType}`] = allocatedPort;
          }
        }
      } else {
        for (const [serviceKey, serverType] of Object.entries(serviceTypes)) {
          const customBase = basePorts[serviceKey];
          const allocatedPort = portAllocator.allocatePort(
            projectName,
            serviceKey,
            serverType,
            customBase
          );
          ports[serviceKey] = allocatedPort;
          components[`${serviceKey}::${serverType}`] = allocatedPort;
        }
      }

      const ticket = `ticket-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      registry.registerProject(projectName, projectPath, components, ticket);

      console.log(`✨ Project "${projectName}" registered with components: ${JSON.stringify(components)}`);
      res.status(201).json({
        ports,
        components,
        ticket,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Failed to register project',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
