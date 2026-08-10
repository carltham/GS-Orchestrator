import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { generateProcessAdapter, InspectionPayload } from './generators/adapterGenerator';
import { processRegistry, ProcessHeartbeat } from './services/ProcessRegistryService';

const PORT = process.env.PROCESS_SERVER_PORT ? parseInt(process.env.PROCESS_SERVER_PORT, 10) : 9999;

const app = express();

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: 'ProcessServer',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// GET /install.sh - Serves shell installer script
app.get('/install.sh', (req: Request, res: Response) => {
  const scriptPath = path.join(__dirname, 'templates', 'install.sh');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.sendFile(scriptPath);
  } else {
    res.status(404).send('# Error: install.sh template not found');
  }
});

// GET /install.js - Serves Node.js installer script
app.get('/install.js', (req: Request, res: Response) => {
  const scriptPath = path.join(__dirname, 'templates', 'install.js');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(scriptPath);
  } else {
    res.status(404).send('// Error: install.js template not found');
  }
});

// POST /api/installer/generate - Compiles and returns tailored ProcessAdapter.js
app.post('/api/installer/generate', (req: Request, res: Response) => {
  const payload: InspectionPayload = req.body || {};
  const adapterCode = generateProcessAdapter(payload);

  res.setHeader('Content-Type', 'application/javascript');
  res.status(200).send(adapterCode);
});

// GET /api/process/signals - Renders and consumes pending control signals for a project
app.get('/api/process/signals', (req: Request, res: Response) => {
  const projectName = (req.query.projectName as string) || '*';
  const signals = processRegistry.consumeSignalsForProject(projectName);
  res.json({ projectName, signals });
});

// POST /api/process/heartbeat - Receives health heartbeats from client processes
app.post('/api/process/heartbeat', (req: Request, res: Response) => {
  const heartbeat: ProcessHeartbeat = req.body;
  if (!heartbeat || !heartbeat.projectName) {
    return res.status(400).json({ error: 'projectName is required in heartbeat payload' });
  }

  processRegistry.updateHeartbeat(heartbeat);
  res.json({ status: 'acknowledged', timestamp: new Date().toISOString() });
});

// GET /api/process/heartbeats - Listing active processes
app.get('/api/process/heartbeats', (req: Request, res: Response) => {
  res.json({ processes: processRegistry.getHeartbeats() });
});

// POST /api/orchestrator/shutdown - Queues shutdown signal specifically targeting GS-Orchestrator
app.post('/api/orchestrator/shutdown', (req: Request, res: Response) => {
  const signal = processRegistry.queueSignal({
    targetProject: 'GS-Orchestrator',
    action: 'SHUTDOWN'
  });

  console.log('[ProcessServer] Queued shutdown signal for GS-Orchestrator:', signal);
  res.json({
    status: 'shutdown_queued',
    target: 'GS-Orchestrator',
    signal
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[ProcessServer] Running on fixed port ${PORT}`);
  });
}

export default app;
