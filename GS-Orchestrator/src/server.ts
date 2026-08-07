/**
 * GS-Orchestrator: Central service coordinator
 * Manages port allocation and service discovery for all 14 projects
 */

import express, { Express, Request, Response } from 'express';
import * as path from 'path';
import { PortAllocator } from './services/portAllocator';
import { Registry } from './services/registry';

const app: Express = express();
const PORT = 9000;

// Initialize services
const registryPath = path.join(__dirname, '..', 'registry.json');
const registry = new Registry(registryPath);
const portAllocator = new PortAllocator();

// Restore state from registry
const registryState = registry.getState();
portAllocator.restoreState({
  allocatedPorts: registryState.projects as any, // Simplified for now
  nextPortBase: registryState.nextPortBase,
});

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
 *   "project": "GSShopper",
 *   "path": "/path/to/gsshopper"
 * }
 * 
 * Response:
 * {
 *   "backend": 4200,
 *   "frontend": 4201,
 *   "database": 5433
 * }
 */
app.post('/api/register', (req: Request, res: Response) => {
  try {
    const { project, path: projectPath } = req.body;

    if (!project || !projectPath) {
      return res.status(400).json({
        error: 'Missing required fields: project, path',
      });
    }

    // Check if already registered
    const existing = registry.getProject(project);
    if (existing) {
      return res.json({
        message: 'Project already registered',
        backend: existing.ports.backend,
        frontend: existing.ports.frontend,
        database: existing.ports.database || 5433,
      });
    }

    // Allocate ports
    const backend = portAllocator.allocatePort(project, 'backend');
    const frontend = portAllocator.allocatePort(project, 'frontend');
    const database = 5433; // Fixed database port for now

    const ports = {
      backend,
      frontend,
      database,
    };

    // Register in registry
    registry.registerProject(project, projectPath, ports);

    res.status(201).json({
      message: 'Project registered successfully',
      backend,
      frontend,
      database,
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
 * GET /api/ports/:project
 * Get ports for a specific project
 * 
 * Response:
 * {
 *   "backend": 4200,
 *   "frontend": 4201,
 *   "database": 5433
 * }
 */
app.get('/api/ports/:project', (req: Request, res: Response) => {
  try {
    const { project } = req.params;

    const projectEntry = registry.getProject(project);
    if (!projectEntry) {
      return res.status(404).json({
        error: `Project "${project}" not found in registry`,
      });
    }

    res.json({
      backend: projectEntry.ports.backend,
      frontend: projectEntry.ports.frontend,
      database: projectEntry.ports.database || 5433,
    });
  } catch (error) {
    console.error('Ports query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve ports',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/status
 * Get status of all registered projects
 * 
 * Response:
 * {
 *   "projects": [
 *     { "name": "GSShopper", "status": "running", "ports": {...} },
 *     ...
 *   ]
 * }
 */
app.get('/api/status', (req: Request, res: Response) => {
  try {
    const allProjects = registry.getAllProjects();

    const projects = Object.values(allProjects).map((project) => ({
      name: project.name,
      status: project.status,
      ports: project.ports,
      registeredAt: project.registeredAt,
      pid: project.pid,
    }));

    res.json({
      total: projects.length,
      projects,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Status query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/status/:project
 * Get status of a specific project
 */
app.get('/api/status/:project', (req: Request, res: Response) => {
  try {
    const { project } = req.params;

    const projectEntry = registry.getProject(project);
    if (!projectEntry) {
      return res.status(404).json({
        error: `Project "${project}" not found`,
      });
    }

    res.json({
      name: projectEntry.name,
      status: projectEntry.status,
      ports: projectEntry.ports,
      registeredAt: projectEntry.registeredAt,
      pid: projectEntry.pid,
    });
  } catch (error) {
    console.error('Project status error:', error);
    res.status(500).json({
      error: 'Failed to retrieve project status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎯 GS-Orchestrator running on http://localhost:${PORT}`);
  console.log(`📋 Registry: ${registryPath}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   /api/register         - Register a project`);
  console.log(`  GET    /api/ports/:project   - Get project ports`);
  console.log(`  GET    /api/status           - Get all projects status`);
  console.log(`  GET    /api/status/:project  - Get specific project status`);
  console.log(`  GET    /health               - Health check`);
});
