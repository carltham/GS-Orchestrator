/**
 * GS-Orchestrator: Central service coordinator
 * Manages port allocation and service discovery for all 14 projects
 */

import express, { Express, Request, Response } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import { PortAllocator } from './services/portAllocator';
import { Registry } from './services/registry';

const app: Express = express();
const PORT = 9000;

// Initialize services
const registryPath = path.join(__dirname, '..', 'registry.json');
const registry = new Registry(registryPath);
const portAllocator = new PortAllocator(registry);

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
app.post('/api/register', (req: Request, res: Response) => {
  try {
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
      console.log(`✅ Project "${projectName}" already registered, returning existing ports`);
      return res.json({
        ports: {
          backend: existing.ports.backend,
          frontend: existing.ports.frontend,
          database: existing.ports.database || 5433,
        },
        ticket: existing.ticket,
        timestamp: existing.registeredAt,
      });
    }

    // Allocate ports
    const backend = portAllocator.allocatePort(projectName, 'backend');
    const frontend = portAllocator.allocatePort(projectName, 'frontend');
    const database = 5433; // Fixed database port
    const ticket = `ticket-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const ports = {
      backend,
      frontend,
      database,
    };

    // Register in registry
    registry.registerProject(projectName, projectPath, ports, ticket);

    console.log(`✨ Project "${projectName}" registered with ports: ${backend}, ${frontend}`);
    res.status(201).json({
      ports,
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

// Start server
app.listen(PORT, () => {
  console.log(`🎯 GS-Orchestrator running on http://localhost:${PORT}`);
  console.log(`📋 Registry: ${registryPath}`);
  console.log(`\nSupported Endpoints:`);
  console.log(`  POST   /api/register   - Register a project and allocate ports`);
  console.log(`  POST   /api/health     - Receive health report from project`);
  console.log(`  GET    /health         - Health check`);
});
