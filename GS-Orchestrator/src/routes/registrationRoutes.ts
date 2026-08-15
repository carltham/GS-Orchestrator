import * as crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { PortAllocatorService } from '../services/PortAllocatorService';
import { RegistryService } from '../services/RegistryService';
import { ServerScannerService } from '../services/ServerScannerService';
import { SystemConfigService } from '../services/SystemConfigService';
import { SubSystemInfo } from '../domain/ProjectEntry';

export function createRegistrationRoutes(
  registry: RegistryService,
  portAllocator: PortAllocatorService,
  serverScanner: ServerScannerService,
  selfProjectName: string
): Router {
  const router = Router();
  const sysConfig = SystemConfigService.getInstance();

  // DELETE /orch/project/:projectName
  // Queues DELETE signal to client to unregister and terminate client
  router.delete('/orch/project/:projectName', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: sysConfig.formatError('missingProjectName'),
        });
      }

      if ((projectName === selfProjectName || sysConfig.isProtectedService(projectName)) && sysConfig.getRules().preventUnregister) {
        return res.status(400).json({
          error: sysConfig.formatError('cannotStopSelf', { projectName }),
        });
      }

      const project = registry.getProject(projectName);
      if (!project) {
        return res.status(404).json({
          error: sysConfig.formatError('projectNotFound', { projectName }),
        });
      }

      const hasComponents = Object.keys(project.components || {}).length > 0;
      if (hasComponents) {
        // Queue a DELETE signal for the client via Process Server
        await fetch('http://localhost:9999/ps/process/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetProject: projectName, action: 'DELETE' })
        }).catch(err => {
          console.warn(`⚠️ Could not post DELETE signal to Process Server: ${err.message}`);
        });
      }

      // Remove from local Orchestrator registry if present
      registry.unregisterProject(projectName);

      // Remove from Process Server (:9999) master registry
      await fetch(`http://localhost:9999/ps/project/${encodeURIComponent(projectName)}`, {
        method: 'DELETE'
      }).catch(() => {});

      console.log(`🗑️ Project "${projectName}" unregistered${hasComponents ? ' and DELETE signal queued for client' : ''}.`);
      return res.json({
        message: hasComponents
          ? `Project "${projectName}" unregistration requested. DELETE signal queued for client.`
          : `Project "${projectName}" unregistered.`,
        projectName,
        status: 'unregistered',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Unregistration error:', error);
      res.status(500).json({
        error: sysConfig.formatError('unregisterFailed'),
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /orch/project/:projectName/restart
  router.post('/orch/project/:projectName/restart', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: sysConfig.formatError('missingProjectName'),
        });
      }

      const project = registry.getProject(projectName);
      if (!project) {
        return res.status(404).json({
          error: sysConfig.formatError('projectNotFound', { projectName }),
        });
      }

      const hasComponents = Object.keys(project.components || {}).length > 0;
      const nextStatus = hasComponents ? 'starting' : 'running';
      project.status = nextStatus;
      registry.updateProject(projectName, project);

      // Sync status to Process Server (:9999)
      await fetch(`http://localhost:9999/ps/project/${encodeURIComponent(projectName)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      }).catch(() => {});

      // Extract ports for the START signal
      const ports: Record<string, number> = {};
      if (project.components) {
        for (const [key, info] of Object.entries(project.components)) {
          const serviceName = key.split('::')[0] || key;
          ports[serviceName] = info.port;
        }
      }

      if (hasComponents) {
        // Queue START signal on ProcessServer
        await fetch('http://localhost:9999/ps/process/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetProject: projectName,
            action: 'START',
            ports
          })
        }).catch(err => {
          console.warn(`⚠️ Could not post START signal to Process Server: ${err.message}`);
        });
      }

      console.log(`🚀 Project "${projectName}" status changed to ${nextStatus}${hasComponents ? '. START signal queued for client.' : '.'}`);
      return res.json({
        message: hasComponents
          ? `Project "${projectName}" restart initiated. START signal queued for client.`
          : `Project "${projectName}" resumed immediately because it has no components.`,
        projectName,
        status: nextStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Restart error:', error);
      res.status(500).json({
        error: sysConfig.formatError('restartFailed'),
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /orch/project/:projectName/stop
  router.post('/orch/project/:projectName/stop', async (req: Request, res: Response) => {
    try {
      const projectName = req.params.projectName;

      if (!projectName) {
        return res.status(400).json({
          error: sysConfig.formatError('missingProjectName'),
        });
      }

      if ((projectName === selfProjectName || sysConfig.isProtectedService(projectName)) && sysConfig.getRules().preventStop) {
        return res.status(400).json({
          error: sysConfig.formatError('cannotStopSelf', { projectName }),
        });
      }

      const project = registry.getProject(projectName);
      if (!project) {
        return res.status(404).json({
          error: sysConfig.formatError('projectNotFound', { projectName }),
        });
      }

      const hasComponents = Object.keys(project.components || {}).length > 0;
      const nextStatus = hasComponents ? 'stopping' : 'stopped';
      project.status = nextStatus;
      registry.updateProject(projectName, project);

      // Sync status to Process Server (:9999)
      await fetch(`http://localhost:9999/ps/project/${encodeURIComponent(projectName)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      }).catch(() => {});

      if (hasComponents) {
        // Queue a stop signal for the client via Process Server
        await fetch('http://localhost:9999/ps/process/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetProject: projectName, action: 'STOP' })
        }).catch(err => {
          console.warn(`⚠️ Could not post STOP signal to Process Server: ${err.message}`);
        });
      }

      console.log(`🛑 Project "${projectName}" status changed to ${nextStatus}.`);
      return res.json({
        message: hasComponents
          ? `Project "${projectName}" is stopping. Stop signal queued for client.`
          : `Project "${projectName}" stopped immediately because it has no components.`,
        projectName,
        status: nextStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Stop error:', error);
      res.status(500).json({
        error: sysConfig.formatError('unregisterFailed'),
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
          error: sysConfig.formatError('missingProjectName'),
        });
      }

      if ((projectName === selfProjectName || sysConfig.isProtectedService(projectName)) && sysConfig.getRules().preventMarkStopped) {
        return res.status(400).json({
          error: sysConfig.formatError('cannotMarkStoppedSelf', { projectName }),
        });
      }

      const project = registry.getProject(projectName);
      if (project) {
        project.status = 'stopped';
        registry.updateProject(projectName, project);

        // Sync status to Process Server (:9999)
        await fetch(`http://localhost:9999/ps/project/${encodeURIComponent(projectName)}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'stopped' })
        }).catch(() => {});

        console.log(`✅ Project "${projectName}" marked as stopped in registry`);
        return res.json({
          message: `Project "${projectName}" status updated to stopped`,
          projectName,
          status: 'stopped',
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(404).json({
          error: sysConfig.formatError('projectNotFound', { projectName }),
        });
      }
    } catch (error) {
      console.error('Stop confirmation error:', error);
      res.status(500).json({
        error: sysConfig.formatError('stopConfirmationFailed'),
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
          error: sysConfig.formatError('missingRequiredFields'),
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

        // Sync status to Process Server (:9999)
        await fetch(`http://localhost:9999/ps/project/${encodeURIComponent(projectName)}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'running' })
        }).catch(() => {});

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

      // Register on ProcessServer (:9999) master registry as well
      await fetch('http://localhost:9999/ps/project/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          path: projectPath,
          serviceTypes,
          ticket
        })
      }).catch(() => {});

      // Sync running status to Process Server (:9999)
      await fetch(`http://localhost:9999/ps/project/${encodeURIComponent(projectName)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' })
      }).catch(() => {});

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
        error: sysConfig.formatError('registrationFailed'),
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
