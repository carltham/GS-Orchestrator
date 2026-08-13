/**
 * GS-Orchestrator: Central service coordinator
 * Manages port allocation and service discovery for all 14 projects
 */

import express, { Express } from 'express';
import * as path from 'path';
import { RegistryService } from './services/RegistryService';
import { ServerScannerService } from './services/ServerScannerService';
import { PortAllocatorService } from './services/PortAllocatorService';
import { UserService } from './services/UserService';
import { detectOwnProjectName } from './utils/selfDetector';
import { showBanner } from './utils/banner';
import { prepareCors, prepareRoutes, prepareStaticAssets } from './app';

const app: Express = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;
const SELF_PROJECT_NAME = detectOwnProjectName();

// Persistence Paths
let registryPath: string;
let unregisteredPath: string;
let usersPath: string;

// Core Domain Services (Singletons)
let registry: RegistryService;
let serverScanner: ServerScannerService;
let portAllocator: PortAllocatorService;
let userService: UserService;

function init(): void {
  // Setup persistence JSON directory links
  registryPath = path.join(__dirname, '..', '..', 'db', 'registry.json');
  unregisteredPath = path.join(__dirname, '..', '..', 'db', 'unregistered-servers.json');
  usersPath = path.join(__dirname, '..', '..', 'db', 'users.json');

  // Load backend domain singletons
  registry = new RegistryService(registryPath);
  serverScanner = new ServerScannerService(unregisteredPath, registry);
  portAllocator = new PortAllocatorService(registry, serverScanner);
  userService = new UserService(usersPath);
}

// Trigger initialization
init();

// Configure the container / express app controller middleware
prepareCors(app);
app.use(express.json());
prepareRoutes(app, userService, registry, PORT, portAllocator, serverScanner, SELF_PROJECT_NAME);
prepareStaticAssets(app);

// Server Spawning & Active Port Listen
if (require.main === module) {
  app.listen(PORT, async () => {
    showBanner(PORT, registryPath, unregisteredPath, usersPath);
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

// Exportable instance bindings (preserved exports for tests/consumers)
export { app, registry, serverScanner, portAllocator, userService, SELF_PROJECT_NAME };
