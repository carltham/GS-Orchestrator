import { Request, Response } from 'express';
import { processRegistry, ProcessHeartbeat } from '../models/ProcessRegistry';
import { projectRegistry, ProjectEntry } from '../models/ProjectRegistry';
import { SystemConfigService } from '../services/SystemConfigService';

export class ProcessController {
  // GET /ps/process/signals
  public getSignals(req: Request, res: Response): any {
    const projectName = (req.query.projectName as string) || '*';
    const claim = req.query.claim === 'true';
    const consume = req.query.consume === 'true';
    const clientInstanceId = req.query.clientInstanceId as string | undefined;

    if (claim && !clientInstanceId) {
      return res.status(400).json({ error: 'clientInstanceId is required when claim=true' });
    }

    const signals = claim
      ? processRegistry.claimSignalsForProject(projectName, clientInstanceId!)
      : consume
        ? processRegistry.consumeSignalsForProject(projectName)
        : processRegistry.peekSignalsForProject(projectName);

    res.json({ projectName, claim, consume, signals });
  }

  // POST /ps/process/signals
  public queueSignal(req: Request, res: Response): any {
    const { targetProject, action, idempotencyKey } = req.body || {};
    let { ports } = req.body || {};
    const sysConfig = SystemConfigService.getInstance();

    if (!targetProject || !action) {
      return res.status(400).json({ error: 'targetProject and action are required' });
    }
    if (!['START', 'STOP', 'DELETE'].includes(action)) {
      return res.status(400).json({ error: `Unsupported signal action: ${action}` });
    }
    if (targetProject === '*') {
      return res.status(400).json({ error: 'Broadcast signals require explicit project targets' });
    }

    if (sysConfig.isProtectedService(targetProject)) {
      const blocked = action === 'STOP'
        ? sysConfig.getRules().preventStop
        : action === 'DELETE'
          ? sysConfig.getRules().preventUnregister
          : false;
      if (blocked) {
        return res.status(403).json({
          error: sysConfig.formatError('cannotStopSelf', { projectName: targetProject })
        });
      }
    }

    const project = projectRegistry.getProject(targetProject);
    if (!project) {
      return res.status(404).json({ error: `Project "${targetProject}" was not found` });
    }

    if (action === 'START' && !ports) {
      ports = Object.fromEntries(
        Object.entries(project.components).map(([componentKey, component]) => [
          componentKey.split('::')[0],
          component.port
        ])
      );
    }

    const signal = processRegistry.queueSignal({
      targetProject,
      targetClientInstanceId: project.clientInstanceId,
      action,
      ports,
      idempotencyKey: idempotencyKey || req.get('Idempotency-Key')
    });

    res.status(201).json({ status: 'queued', signal });
  }

  public acknowledgeSignal(req: Request, res: Response): any {
    const clientInstanceId = req.body?.clientInstanceId;
    if (!clientInstanceId) {
      return res.status(400).json({ error: 'clientInstanceId is required' });
    }
    const signal = processRegistry.acknowledgeSignal(req.params.id, clientInstanceId);
    if (!signal) {
      return res.status(409).json({ error: 'Signal is not leased by this client instance' });
    }
    if (signal.action === 'DELETE') {
      projectRegistry.unregisterProject(signal.targetProject);
      processRegistry.removeHeartbeat(signal.targetProject);
      processRegistry.removeSignalsForProject(signal.targetProject);
    }
    res.json({ status: 'acknowledged', signalId: req.params.id });
  }

  public releaseSignal(req: Request, res: Response): any {
    const clientInstanceId = req.body?.clientInstanceId;
    if (!clientInstanceId) {
      return res.status(400).json({ error: 'clientInstanceId is required' });
    }
    if (!processRegistry.releaseSignal(req.params.id, clientInstanceId)) {
      return res.status(409).json({ error: 'Signal is not leased by this client instance' });
    }
    res.json({ status: 'released', signalId: req.params.id });
  }

  // POST /ps/process/heartbeat
  public updateHeartbeat(req: Request, res: Response): any {
    const heartbeat: ProcessHeartbeat = req.body;
    if (!heartbeat || !heartbeat.projectName) {
      return res.status(400).json({ error: 'projectName is required in heartbeat payload' });
    }

    const project = projectRegistry.getProject(heartbeat.projectName);
    if (project) {
      if (project.clientInstanceId && heartbeat.clientInstanceId !== project.clientInstanceId) {
        return res.status(409).json({ error: 'Heartbeat came from a stale client instance' });
      }
    }

    processRegistry.updateHeartbeat(heartbeat);

    if (project) {
      const status = heartbeat.status.toLowerCase() as ProjectEntry['status'];
      const components = { ...project.components };

      for (const [componentKey, telemetry] of Object.entries(heartbeat.components || {})) {
        const registered = components[componentKey];
        if (!registered && !Number.isFinite(telemetry.port)) continue;

        components[componentKey] = {
          ...registered,
          ...telemetry,
          port: Number.isFinite(telemetry.port) ? telemetry.port : registered.port
        };
      }

      projectRegistry.updateProject(heartbeat.projectName, {
        ...project,
        status,
        pid: heartbeat.pid ?? project.pid,
        components
      });
    }

    res.json({ status: 'acknowledged', timestamp: new Date().toISOString() });
  }

  // GET /ps/process/heartbeats
  public getHeartbeats(req: Request, res: Response): void {
    res.json({ processes: processRegistry.getHeartbeats() });
  }
}

export const processController = new ProcessController();
