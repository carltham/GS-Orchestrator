import request from 'supertest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { app, serverScanner } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator Server SFT - Unregistered Server Scanner', () => {
  const dbDir = path.join(__dirname, '..', '..', '..', 'db');
  const registryPath = path.join(dbDir, 'registry.json');
  const unregisteredPath = path.join(dbDir, 'unregistered-servers.json');

  beforeEach(() => {
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

    const res = await request(app).get('/orch/project/unregistered');
    expect(res.status).toBe(200);
    expect(res.body.servers).toBeDefined();

    const dummy = res.body.servers.find((s: any) => s.port === testPort);
    expect(dummy).toBeDefined();
    expect(dummy.pid).toBeDefined();
    expect(dummy.projectPath).toBeDefined();
    expect(dummy.projectName).toBeDefined();
  });
});
