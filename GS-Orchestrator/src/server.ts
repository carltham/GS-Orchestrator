/**
 * GS-Orchestrator: Central service coordinator
 * Manages port allocation and service discovery for all 14 projects
 */

import express, { Express } from 'express';
import * as path from 'path';
import { createHealthRoutes } from './routes/healthRoutes';
import { createRegistrationRoutes } from './routes/registrationRoutes';
import { createRegistryRoutes } from './routes/registryRoutes';
import { createScannerRoutes } from './routes/scannerRoutes';
import signalRoutes from './routes/signalRoutes';
import { PortAllocatorService } from './services/PortAllocatorService';
import { RegistryService } from './services/RegistryService';
import { ServerScannerService } from './services/ServerScannerService';
import { detectOwnProjectName } from './utils/selfDetector';

const app: Express = express();
const PORT = 9000;
const SELF_PROJECT_NAME = detectOwnProjectName();

// Persistence Paths
const registryPath = path.join(__dirname, '..', 'dist', 'registry.json');
const unregisteredPath = path.join(__dirname, '..', 'dist', 'unregistered-servers.json');

// Core Domain Services
const registry = new RegistryService(registryPath);
const serverScanner = new ServerScannerService(unregisteredPath, registry);
const portAllocator = new PortAllocatorService(registry, serverScanner);

// Simple manual CORS header middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Installer Script Endpoints
app.get('/install.sh', (req, res) => {
  const scriptPath = path.join(__dirname, '..', '..', 'lib', 'orchestrator-client', 'install-client.sh');
  res.sendFile(scriptPath);
});

app.get('/install.js', (req, res) => {
  const scriptPath = path.join(__dirname, '..', '..', 'lib', 'orchestrator-client', 'install-client.js');
  res.sendFile(scriptPath);
});

// Routes
app.use(createHealthRoutes(registry, PORT));
app.use(createRegistrationRoutes(registry, portAllocator, serverScanner, SELF_PROJECT_NAME));
app.use(createRegistryRoutes(registry));
app.use(createScannerRoutes(serverScanner));
app.use('/api/signals', signalRoutes);

export { app, registry, serverScanner, portAllocator, SELF_PROJECT_NAME };

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🎯 GS-Orchestrator running on http://localhost:${PORT}`);
    console.log(`📋 Registry: ${registryPath}`);
    console.log(`🔍 Unregistered Servers File: ${unregisteredPath}`);
    console.log(`\nSupported Endpoints:`);
    console.log(`  POST   /api/register      - Register a project and allocate ports`);
    console.log(`  DELETE /api/register/:name - Unregister a project`);
    console.log(`  POST   /api/health        - Receive health report from project`);
    console.log(`  GET    /api/signals/:name - Get pending signals for project`);
    console.log(`  POST   /api/signals/:name/ack - Mark signals as processed`);
    console.log(`  GET    /api/unregistered  - List detected unregistered running servers`);
    console.log(`  GET    /health            - Health check`);

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
