import { Request, Response } from 'express';
import { processRegistry, ProcessHeartbeat } from '../models/ProcessRegistry';

export class ProcessController {
  // GET /ps/process/signals
  public getSignals(req: Request, res: Response): void {
    const projectName = (req.query.projectName as string) || '*';
    const consume = req.query.consume !== 'false';
    
    const signals = consume 
      ? processRegistry.consumeSignalsForProject(projectName)
      : processRegistry.peekSignalsForProject(projectName);

    res.json({ projectName, consume, signals });
  }

  // POST /ps/process/signals
  public queueSignal(req: Request, res: Response): any {
    const { targetProject, action, ports } = req.body || {};
    if (!targetProject || !action) {
      return res.status(400).json({ error: 'targetProject and action are required' });
    }

    const signal = processRegistry.queueSignal({
      targetProject,
      action,
      ports
    });

    res.status(201).json({ status: 'queued', signal });
  }

  // POST /ps/process/heartbeat
  public updateHeartbeat(req: Request, res: Response): any {
    const heartbeat: ProcessHeartbeat = req.body;
    if (!heartbeat || !heartbeat.projectName) {
      return res.status(400).json({ error: 'projectName is required in heartbeat payload' });
    }

    processRegistry.updateHeartbeat(heartbeat);
    res.json({ status: 'acknowledged', timestamp: new Date().toISOString() });
  }

  // GET /ps/process/heartbeats
  public getHeartbeats(req: Request, res: Response): void {
    res.json({ processes: processRegistry.getHeartbeats() });
  }
}

export const processController = new ProcessController();
