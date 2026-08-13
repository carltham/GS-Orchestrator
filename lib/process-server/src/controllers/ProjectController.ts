import { Request, Response } from 'express';
import { projectRegistry } from '../models/ProjectRegistry';

export class ProjectController {
  // POST /ps/project/register
  public registerProject(req: Request, res: Response): any {
    try {
      const projectName = req.body.projectName || req.body.project;
      const projectPath = req.body.path;
      const serviceTypes = req.body.serviceTypes || { backend: 'node-ts', frontend: 'angular' };
      const ticket = req.body.ticket;

      if (!projectName || !projectPath) {
        return res.status(400).json({
          error: 'Missing required fields: projectName, path',
        });
      }

      console.log(`[ProcessServer:ProjectController] Incoming registration hook for "${projectName}" at path "${projectPath}"`);
      const entry = projectRegistry.registerProject(projectName, projectPath, serviceTypes, ticket);

      // Map components back to ports format expected by standard Process Clients
      const ports: Record<string, number> = {};
      for (const [compKey, info] of Object.entries(entry.components)) {
        const serviceKey = compKey.split('::')[0] || compKey;
        ports[serviceKey] = info.port;
      }

      res.status(200).json({
        status: 'registered',
        project: entry.name,
        ports,
        components: entry.components
      });
    } catch (err: any) {
      console.error('[ProcessServer:ProjectController] Registration failed:', err);
      res.status(500).json({
        error: 'Dynamic registration process failed',
        details: err.message
      });
    }
  }

  // GET /ps/project/list
  public getProjects(req: Request, res: Response): void {
    const list = projectRegistry.getProjects();
    res.json({ projects: list });
  }

  // GET /ps/project/:name
  public getProject(req: Request, res: Response): any {
    const name = req.params.name;
    const project = projectRegistry.getProject(name);
    if (!project) {
      return res.status(404).json({ error: `Project "${name}" is not registered` });
    }
    res.json(project);
  }

  // DELETE /ps/project/:name
  public unregisterProject(req: Request, res: Response): any {
    const name = req.params.name;
    const success = projectRegistry.unregisterProject(name);
    if (!success) {
      return res.status(404).json({ error: `Project "${name}" was not found` });
    }
    res.json({ status: 'unregistered', project: name });
  }
}

export const projectController = new ProjectController();
