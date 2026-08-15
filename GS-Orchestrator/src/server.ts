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
const userService = new UserService(usersPath);

// Configure the container / express app controller middleware
prepareCors(app);
app.use(express.json());
prepareRoutes(app, userService, registry, PORT);
prepareStaticAssets(app);

// Server Spawning & Active Port Listen
if (require.main === module) {
  app.listen(PORT, async () => {
    showBanner(PORT, registryPath, unregisteredPath, usersPath);
  });
}

// Exportable instance bindings (preserved exports for tests/consumers)
export { app, registry, userService };
