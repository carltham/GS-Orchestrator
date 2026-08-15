import request from 'supertest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { app, pureServerScanner } from '../../../lib/process-server/src/server';

describe('ProcessServer SFT - Unregistered Server Scanner', () => {
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
    dummyServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain', Server: 'Express' });
      res.end('OK');
    });
    dummyServer.listen(testPort, '127.0.0.1', () => done());
  });

  afterAll((done) => {
    dummyServer.close(() => done());
  });

  test('scans running servers and returns unregistered servers list', async () => {
    const discovered = await pureServerScanner.scanRunningServers();
    expect(discovered.some((s) => s.port === testPort)).toBe(true);

    const res = await request(app).get('/ps/host/unregistered');
    expect(res.status).toBe(200);
    expect(res.body.servers).toBeInstanceOf(Array);
    expect(res.body.servers.some((s: any) => s.port === testPort)).toBe(true);
  }, 20000);
});
