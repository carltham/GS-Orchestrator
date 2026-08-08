/**
 * GS-Orchestrator: Central service coordinator
 * Manages port allocation and service discovery for all 14 projects
 */

import express, { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import { PortAllocator } from './services/portAllocator';
import { Registry } from './services/registryHandler';
import { ServerScanner } from './services/serverScanner';

const app: Express = express();
const PORT = 9000;

// Dynamic self-detection of orchestrator's own project name via git root directory
function detectSelfProjectName(): string {
  try {
    let currentDir = __dirname;
    while (currentDir !== path.parse(currentDir).root) {
      if (path.basename(currentDir) === 'GS-Orchestrator' || path.basename(currentDir) === 'gs-orchestrator') {
        return path.basename(currentDir);
      }
      if (require('fs').existsSync(path.join(currentDir, '.git'))) {
        return path.basename(currentDir);
      }
      currentDir = path.dirname(currentDir);
    }
  } catch (err) {
    // Fallback
  }
  return 'GS-Orchestrator';
}

const SELF_PROJECT_NAME = detectSelfProjectName();

// Initialize services
const registryPath = path.join(__dirname, '..', 'dist', 'registry.json');
const unregisteredPath = path.join(__dirname, '..', 'dist', 'unregistered-servers.json');

const registry = new Registry(registryPath);
const serverScanner = new ServerScanner(unregisteredPath, registry);
const portAllocator = new PortAllocator(registry, serverScanner);

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

/**
 * POST /api/register
 * Register a project and allocate ports
 * 
 * Request:
 * {
 *   "projectName": "MyProject",
 *   "path": "/path/to/myproject"
 * }
 * 
 * Response:
 * {
 *   "ports": {
 *     "backend": 4200,
 *     "frontend": 4201,
 *     "database": 5433
 *   },
 *   "timestamp": "2026-08-08T10:00:00Z"
 * }
 */
app.post('/api/register', async (req: Request, res: Response) => {
  try {
    // Perform fast on-demand scan before registration to guarantee port state is fresh
    await serverScanner.scanRunningServers().catch(() => {});

    // Accept both projectName and project for compatibility
    const projectName = req.body.projectName || req.body.project;
    const projectPath = req.body.path;

    if (!projectName || !projectPath) {
      return res.status(400).json({
        error: 'Missing required fields: projectName, path',
      });
    }

    // Check if already registered
    const existing = registry.getProject(projectName);
    if (existing) {
      console.log(`✅ Project "${projectName}" already registered, returning existing components`);

      // Reconstruct simple ports map from components map (e.g., "backend::node-ts" -> "backend": port)
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

    // Accept optional server types & base ports sent from client
    const serviceTypes: Record<string, string> = req.body.serviceTypes || {};
    const basePorts: Record<string, number> = req.body.basePorts || {};

    // Fall back to legacy parameters or standard default backend if serviceTypes is empty
    if (Object.keys(serviceTypes).length === 0) {
      if (req.body.backendType) serviceTypes.backend = req.body.backendType;
      if (req.body.frontendType) serviceTypes.frontend = req.body.frontendType;
      if (req.body.databaseType) serviceTypes.database = req.body.databaseType;
      if (Object.keys(serviceTypes).length === 0) {
        serviceTypes.backend = 'node-ts';
      }
    }

    // Dynamically allocate ports ONLY for services specified in serviceTypes
    const ports: Record<string, number> = {};
    const components: Record<string, number> = {};

    // Special case: Orchestrator itself self-detects on register call and assigns itself port 9000
    if (projectName === SELF_PROJECT_NAME) {
      ports['backend'] = 9000;
      components['backend::node-ts'] = 9000;
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

    // Register in registry
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

/**
 * GET /api/count
 * Get total count of registered projects in registry
 */
app.get('/api/count', (req: Request, res: Response) => {
  const count = registry.getProjectCount();
  res.status(200).json({ count });
});

/**
 * GET /api/unregistered
 * Get list of detected running unregistered servers
 */
app.get('/api/unregistered', (req: Request, res: Response) => {
  const data = serverScanner.loadData();
  res.status(200).json(data);
});

/**
 * GET /api/health
 * Health check endpoint for orchestrator availability check
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * POST /api/health
 * Receive health report from a project
 * 
 * Request:
 * {
 *   "projectName": "MyProject",
 *   "health": {
 *     "status": "ok",
 *     "backendStatus": true,
 *     "frontendStatus": true,
 *     "uptimeSeconds": 3600,
 *     "ticket": "ticket-..."
 *   },
 *   "timestamp": "2026-08-08T10:00:00Z"
 * }
 * 
 * Response: 200 OK (empty or minimal)
 */
app.post('/api/health', (req: Request, res: Response) => {
  try {
    const { projectName, health, timestamp } = req.body;

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

    // Update project status with health info
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

export { app, registry, serverScanner, portAllocator, SELF_PROJECT_NAME };

if (require.main === module) {
  // Start server
  app.listen(PORT, async () => {
    console.log(`🎯 GS-Orchestrator running on http://localhost:${PORT}`);
    console.log(`📋 Registry: ${registryPath}`);
    console.log(`🔍 Unregistered Servers File: ${unregisteredPath}`);
    console.log(`\nSupported Endpoints:`);
    console.log(`  POST   /api/register      - Register a project and allocate ports`);
    console.log(`  POST   /api/health        - Receive health report from project`);
    console.log(`  GET    /api/unregistered  - List detected unregistered running servers`);
    console.log(`  GET    /health            - Health check`);

    // Automatically scan for running unmanaged servers on startup and start 30s background loop
    console.log(`\n🔍 Scanning for unregistered running servers...`);
    try {
      const discovered = await serverScanner.scanRunningServers();
      if (discovered.length > 0) {
        console.log(`⚠️  Detected ${discovered.length} unregistered running server(s):`);
        discovered.forEach((s) => console.log(`   - Port ${s.port} (${s.type})`));
      } else {
        console.log(`✅ No unregistered running servers detected`);
      }
    } catch (err) {
      console.error('Error during startup server scan:', err);
    }

    serverScanner.startPeriodicScan(30000);
  });
}
