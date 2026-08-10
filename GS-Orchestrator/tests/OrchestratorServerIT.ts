import request from 'supertest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { app, registry, serverScanner, SELF_PROJECT_NAME } from '../src/server';

describe('GS-Orchestrator Server Integration Tests (IT)', () => {
  const distDir = path.join(__dirname, '..', 'dist');
  const registryPath = path.join(distDir, 'registry.json');
  const unregisteredPath = path.join(distDir, 'unregistered-servers.json');

  beforeEach(() => {
    // Reset test registry & unregistered files before each test
    if (fs.existsSync(registryPath)) {
      fs.writeFileSync(
        registryPath,
        JSON.stringify({ projects: {}, nextPortBase: 4200, lastUpdated: new Date().toISOString() }, null, 2)
      );
    }
    if (fs.existsSync(unregisteredPath)) {
      fs.writeFileSync(
        unregisteredPath,
        JSON.stringify({ lastScanned: new Date().toISOString(), servers: [] }, null, 2)
      );
    }
  });

  describe('1. Health Check Endpoints', () => {
    test('GET /health returns status 200 and healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.port).toBe(9000);
    });

    test('GET /api/health returns status 200 with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('2. Project Registration & Port Allocation (POST /api/register)', () => {
    test('rejects registration with missing parameters', async () => {
      const res = await request(app).post('/api/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    test('registers a standard full-stack project and allocates dynamic ports', async () => {
      const payload = {
        projectName: 'TestApp',
        path: '/tmp/testapp',
        serviceTypes: {
          backend: 'node-ts',
          frontend: 'vite',
          database: 'postgres',
        },
      };

      const res = await request(app).post('/api/register').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.ports).toBeDefined();
      expect(res.body.ports.backend).toBe(3000);
      expect(res.body.ports.frontend).toBe(5173);
      expect(res.body.ports.database).toBe(5433);
      expect(res.body.ticket).toBeDefined();

      // Check disk persistence
      const saved = registry.getProject('TestApp');
      expect(saved).toBeDefined();
      expect(saved?.components['backend::node-ts']).toBe(3000);
      expect(saved?.components['frontend::vite']).toBe(5173);
      expect(saved?.components['database::postgres']).toBe(5433);
    });

    test('self-registers GS-Orchestrator assigning fixed ports 9000 for backend and 9001 for frontend', async () => {
      const payload = {
        projectName: SELF_PROJECT_NAME,
        path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
        serviceTypes: { backend: 'node-ts', frontend: 'angular' },
      };

      const res = await request(app).post('/api/register').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.ports.backend).toBe(9000);
      expect(res.body.ports.frontend).toBe(9001);
      expect(res.body.components['backend::node-ts']).toBe(9000);
      expect(res.body.components['frontend::angular']).toBe(9001);
    });

    test('idempotency: returning existing registration for already registered project', async () => {
      const payload = {
        projectName: 'IdempotentApp',
        path: '/tmp/idempotent',
        serviceTypes: { backend: 'node-ts' },
      };

      const first = await request(app).post('/api/register').send(payload);
      expect(first.status).toBe(201);

      const second = await request(app).post('/api/register').send(payload);
      expect(second.status).toBe(200);
      expect(second.body.ports.backend).toBe(first.body.ports.backend);
    });
  });

  describe('3. Registry Count & Disk Persistence (GET /api/count)', () => {
    test('returns 0 when no projects are registered', async () => {
      const res = await request(app).get('/api/count');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    test('returns accurate count after project registration', async () => {
      await request(app).post('/api/register').send({
        projectName: 'AppOne',
        path: '/tmp/appone',
        serviceTypes: { backend: 'node-ts' },
      });

      await request(app).post('/api/register').send({
        projectName: 'AppTwo',
        path: '/tmp/apptwo',
        serviceTypes: { backend: 'node-ts' },
      });

      const res = await request(app).get('/api/count');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('4. Health Reports (POST /api/health)', () => {
    test('rejects health report for unregistered project with 404', async () => {
      const res = await request(app).post('/api/health').send({
        projectName: 'NonExistentProject',
        health: { status: 'ok' },
      });
      expect(res.status).toBe(404);
    });

    test('accepts health report for registered project and updates status', async () => {
      await request(app).post('/api/register').send({
        projectName: 'HealthyApp',
        path: '/tmp/healthy',
        serviceTypes: { backend: 'node-ts' },
      });

      const res = await request(app).post('/api/health').send({
        projectName: 'HealthyApp',
        health: {
          status: 'ok',
          backendStatus: true,
          frontendStatus: false,
          uptimeSeconds: 120,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      const entry = registry.getProject('HealthyApp');
      expect(entry?.status).toBe('running');
    });
  });

  describe('5. Unregistered Server Scanner & Endpoint (GET /api/unregistered)', () => {
    let dummyServer: http.Server;
    const testPort = 3005;

    beforeAll((done) => {
      // Spawn a dummy TCP server on port 3005
      dummyServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain', Server: 'Express' });
        res.end('OK');
      });
      dummyServer.listen(testPort, '127.0.0.1', () => done());
    });

    afterAll((done) => {
      dummyServer.close(() => done());
    });

    test('scans running servers and persists to dist/unregistered-servers.json', async () => {
      const discovered = await serverScanner.scanRunningServers();
      expect(discovered.some((s) => s.port === testPort)).toBe(true);

      const res = await request(app).get('/api/unregistered');
      expect(res.status).toBe(200);
      expect(res.body.servers).toBeDefined();

      const dummy = res.body.servers.find((s: any) => s.port === testPort);
      expect(dummy).toBeDefined();
      expect(dummy.pid).toBeDefined();
      expect(dummy.projectPath).toBeDefined();
      expect(dummy.projectName).toBeDefined();
    });
  });
});
