import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { generateProcessAdapter, InspectionPayload } from './generators/adapterGenerator';
import { processRegistry, ProcessHeartbeat } from './services/ProcessRegistryService';
import { pureServerScanner } from './services/ServerScannerService';

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

// POST /ps/installer/generate - Compiles and returns tailored ProcessAdapter.js
app.post('/ps/installer/generate', (req: Request, res: Response) => {
  const payload: InspectionPayload = req.body || {};
  const adapterCode = generateProcessAdapter(payload);

  res.setHeader('Content-Type', 'application/javascript');
  res.status(200).send(adapterCode);
});

// GET /ps/process/signals - Renders and consumes pending control signals for a project
app.get('/ps/process/signals', (req: Request, res: Response) => {
  const projectName = (req.query.projectName as string) || '*';
  const consume = req.query.consume !== 'false';
  
  const signals = consume 
    ? processRegistry.consumeSignalsForProject(projectName)
    : processRegistry.peekSignalsForProject(projectName);

  res.json({ projectName, consume, signals });
});

// POST /ps/process/signals - Queues a generic control signal targeting a project
app.post('/ps/process/signals', (req: Request, res: Response) => {
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
});

// POST /ps/process/heartbeat - Receives health heartbeats from client processes
app.post('/ps/process/heartbeat', (req: Request, res: Response) => {
  const heartbeat: ProcessHeartbeat = req.body;
  if (!heartbeat || !heartbeat.projectName) {
    return res.status(400).json({ error: 'projectName is required in heartbeat payload' });
  }

  processRegistry.updateHeartbeat(heartbeat);
  res.json({ status: 'acknowledged', timestamp: new Date().toISOString() });
});

// GET /ps/process/heartbeats - Listing active processes
app.get('/ps/process/heartbeats', (req: Request, res: Response) => {
  res.json({ processes: processRegistry.getHeartbeats() });
});

// GET /ps/host/unregistered - Run machine scanning check for unmanaged listeners
app.get('/ps/host/unregistered', async (req: Request, res: Response) => {
  try {
    const registeredPortsQuery = (req.query.registeredPorts as string) || '';
    const registeredPathsQuery = (req.query.registeredPaths as string) || '';

    const registeredPorts = registeredPortsQuery ? registeredPortsQuery.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p)) : [];
    const registeredPaths = registeredPathsQuery ? registeredPathsQuery.split(',') : [];

    const servers = await pureServerScanner.scanRunningServers(registeredPorts, registeredPaths);
    res.json({
      lastScanned: new Date().toISOString(),
      servers
    });
  } catch (err) {
    res.status(500).json({ error: 'Scanner execution failed', details: err instanceof Error ? err.message : String(err) });
  }
});

// POST /ps/host/check-ports - Quick check if a list of ports are occupied
app.post('/ps/host/check-ports', async (req: Request, res: Response) => {
  try {
    const { ports } = req.body || {};
    if (!Array.isArray(ports)) {
      return res.status(400).json({ error: 'ports query array is required' });
    }

    const results: Record<number, boolean> = {};
    for (const port of ports) {
      results[port] = await pureServerScanner.isPortOccupied(port);
    }
    res.json({ ports: results });
  } catch (err) {
    res.status(500).json({ error: 'Port checking failed', details: err instanceof Error ? err.message : String(err) });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[ProcessServer] Running on fixed port ${PORT}`);
  });
}

export default app;
