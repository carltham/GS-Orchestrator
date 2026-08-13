import * as crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { PortAllocatorService } from '../services/PortAllocatorService';
import { RegistryService } from '../services/RegistryService';
import { ServerScannerService } from '../services/ServerScannerService';
import { SubSystemInfo } from '../domain/ProjectEntry';

export function createRegistrationRoutes(
  registry: RegistryService,
  portAllocator: PortAllocatorService,
  serverScanner: ServerScannerService,
  selfProjectName: string
): Router {
  const router = Router();

  // DELETE /orch/project/:projectName
  router.delete('/orch/project/:projectName', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: 'Missing required parameter: projectName',
        });
      }

      if (projectName === selfProjectName) {
        return res.status(400).json({
          error: `Cannot stop or unregister the main Orchestrator service "${projectName}" itself, as it is the central administration hub.`,
        });
      }

      // Update project status to 'stopping'
      const project = registry.getProject(projectName);
      if (project) {
        project.status = 'stopping';
        registry.updateProject(projectName, project);
      }

      // Queue a stop signal for the client via Process Server
      await fetch('http://localhost:9999/ps/process/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetProject: projectName, action: 'STOP' })
      }).catch(err => {
        console.warn(`⚠️ Could not post STOP signal to Process Server: ${err.message}`);
      });

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

  // POST /orch/reporting/project/:projectName/is-stopped
  // Mark a project as stopped (keep in registry)
  router.post('/orch/reporting/project/:projectName/is-stopped', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: 'Missing required parameter: projectName',
        });
      }

      if (projectName === selfProjectName) {
        return res.status(400).json({
          error: `The main Orchestrator service "${projectName}" is permanently active and cannot be set to stopped.`,
        });
      }

      const project = registry.getProject(projectName);
      if (project) {
        project.status = 'stopped';
        registry.updateProject(projectName, project);
        console.log(`✅ Project "${projectName}" marked as stopped in registry`);
        return res.json({
          message: `Project "${projectName}" status updated to stopped`,
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

  // POST /orch/project/register
  router.post('/orch/project/register', async (req: Request, res: Response) => {
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
        existing.status = 'running';
        existing.registeredAt = new Date().toISOString();

        if (projectName === selfProjectName) {
          existing.components['backend::node-ts'] = { port: 10000, status: 'running' };
          for (const key of Object.keys(existing.components)) {
            if (key.startsWith('frontend::')) {
              existing.components[key] = { port: 10000, status: 'running' };
            }
          }
          if (!existing.components['frontend::angular']) {
            existing.components['frontend::angular'] = { port: 10000, status: 'running' };
          }
        }

        registry.updateProject(projectName, existing);

        console.log(`✅ Project "${projectName}" already registered, updated status to running`);

        const ports: Record<string, number> = {};
        for (const [compKey, info] of Object.entries(existing.components)) {
          const serviceKey = compKey.split('::')[0];
          ports[serviceKey] = info.port;
        }

        return res.json({
          ports,
          components: existing.components,
          ticket: existing.ticket,
          timestamp: existing.registeredAt,
        });
      }

      const hasExplicitServiceTypes = req.body.serviceTypes !== undefined;
      const serviceTypes: Record<string, string> = req.body.serviceTypes || {};
      const basePorts: Record<string, number> = req.body.basePorts || {};

      if (!hasExplicitServiceTypes) {
        if (req.body.backendType) serviceTypes.backend = req.body.backendType;
        if (req.body.frontendType) serviceTypes.frontend = req.body.frontendType;
        if (req.body.databaseType) serviceTypes.database = req.body.databaseType;
        if (Object.keys(serviceTypes).length === 0) {
          serviceTypes.backend = 'node-ts';
        }
      }

      const ports: Record<string, number> = {};
      const components: Record<string, SubSystemInfo> = {};

      if (projectName === selfProjectName) {
        ports['backend'] = 10000;
        components['backend::node-ts'] = { port: 10000, status: 'running' };
        for (const [serviceKey, serverType] of Object.entries(serviceTypes)) {
          if (serviceKey === 'backend') {
            continue;
          } else if (serviceKey === 'frontend') {
            ports['frontend'] = 10000;
            components[`frontend::${serverType}`] = { port: 10000, status: 'running' };
          } else {
            const customBase = basePorts[serviceKey];
            const allocatedPort = portAllocator.allocatePort(
              projectName,
              serviceKey,
              serverType,
              customBase
            );
            ports[serviceKey] = allocatedPort;
            components[`${serviceKey}::${serverType}`] = { port: allocatedPort, status: 'running' };
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
          components[`${serviceKey}::${serverType}`] = { port: allocatedPort, status: 'running' };
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
