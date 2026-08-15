/**
 * express App Controller setup
 */
import express, { Express } from 'express';
import * as path from 'path';
import { createHealthRoutes } from './routes/healthRoutes';
import { createProxyRoutes } from './routes/proxyRoutes';
import { createAuthRoutes } from './routes/authRoutes';
import { createAdminRoutes } from './routes/adminRoutes';
import { RegistryService } from './services/RegistryService';
import { UserService } from './services/UserService';

export function prepareCors(expressApp: Express): void {
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

export function prepareRoutes(
  expressApp: Express,
  userService: UserService,
  registry: RegistryService,
  port: number
): void {
  expressApp.use('/orch/auth', createAuthRoutes(userService));
  expressApp.use('/orch/admin', createAdminRoutes(userService));
  expressApp.use(createHealthRoutes(registry, port));
  expressApp.use(createProxyRoutes());
}

export function prepareStaticAssets(expressApp: Express): void {
  const guiDistPath = path.join(__dirname, '..', '..', 'GS-Orchestrator-GUI', 'dist', 'gs-orchestrator-gui', 'browser');
  
  // Static GUI Asset Hosting
  expressApp.use(express.static(guiDistPath));

  // SPA Fallback: Route all non-API requests safely to index.html
  expressApp.get('*', (req, res, next) => {
    if (req.path.startsWith('/orch') || req.path.startsWith('/reports') || req.path.includes('.')) {
      return next();
    }
    const indexPath = path.join(guiDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send('<h1>GS-Orchestrator Control Center</h1><p>GUI build pending or not found.</p>');
      }
    });
  });
}
