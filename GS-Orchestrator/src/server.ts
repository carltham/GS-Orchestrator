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
import { showBanner } from './utils/banner';
import { prepareCors, prepareRoutes, prepareStaticAssets } from './app';

const app: Express = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;
export const SELF_PROJECT_NAME = 'GS-Orchestrator';

// Persistence Paths
const registryPath = path.join(__dirname, '..', '..', 'db', 'registry.json');
const unregisteredPath = path.join(__dirname, '..', '..', 'db', 'unregistered-servers.json');
const usersPath = path.join(__dirname, '..', '..', 'db', 'users.json');

// Core Domain Services (Singletons)
const registry = new RegistryService(registryPath);
const serverScanner = new ServerScannerService(unregisteredPath, registry);
const portAllocator = new PortAllocatorService(registry, serverScanner);
const userService = new UserService(usersPath);

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
export { app, registry, serverScanner, portAllocator, userService };
