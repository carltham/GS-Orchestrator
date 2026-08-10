import { test, expect } from '@playwright/test';

test.describe('ProcessServer (:9999) - Playwright API Integration Suite', () => {

  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('GET /health returns status ok and port 9999', async ({ request }) => {
    const response = await request.get(`${PROCESS_SERVER_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.server).toBe('ProcessServer');
    expect(body.port).toBe(9999);
  });

  test('GET /install.sh returns valid shell inspector script', async ({ request }) => {
    const response = await request.get(`${PROCESS_SERVER_URL}/install.sh`);
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/x-shellscript');

    const text = await response.text();
    expect(text).toContain('#!/usr/bin/env bash');
    expect(text).toContain('ProcessAdapter.js');
  });

  test('GET /install.js returns valid Node.js inspector script', async ({ request }) => {
    const response = await request.get(`${PROCESS_SERVER_URL}/install.js`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toContain('ProcessInstaller');
    expect(text).toContain('ProcessAdapter.js');
  });

  test('POST /api/installer/generate compiles runnable ProcessAdapter class', async ({ request }) => {
    const payload = {
      workspaceDir: '/tmp/test-workspace',
      projectName: 'TestProject',
      hasPackageJson: true,
      startScript: 'npm start'
    };

    const response = await request.post(`${PROCESS_SERVER_URL}/api/installer/generate`, {
      data: payload
    });

    expect(response.status()).toBe(200);
    const code = await response.text();

    expect(code).toContain('class ProcessAdapter');
    expect(code).toContain('TestProject');
    expect(code).toContain('async start(ports = {})');
    expect(code).toContain('async stop()');
    expect(code).toContain('async getStatus()');
  });

  test('POST /api/process/heartbeat & GET /api/process/heartbeats tracks active telemetry', async ({ request }) => {
    const heartbeat = {
      projectName: 'TestService',
      status: 'RUNNING',
      pid: 12345
    };

    // Send Heartbeat
    const postRes = await request.post(`${PROCESS_SERVER_URL}/api/process/heartbeat`, {
      data: heartbeat
    });
    expect(postRes.status()).toBe(200);

    // Get Active Heartbeats
    const getRes = await request.get(`${PROCESS_SERVER_URL}/api/process/heartbeats`);
    expect(getRes.status()).toBe(200);

    const body = await getRes.json();
    expect(body.processes).toBeDefined();

    const matched = body.processes.find((p: any) => p.projectName === 'TestService');
    expect(matched).toBeDefined();
    expect(matched.status).toBe('RUNNING');
    expect(matched.pid).toBe(12345);
  });

  test('POST /api/orchestrator/shutdown queues shutdown signal for GS-Orchestrator', async ({ request }) => {
    const shutdownRes = await request.post(`${PROCESS_SERVER_URL}/api/orchestrator/shutdown`);
    expect(shutdownRes.status()).toBe(200);

    const body = await shutdownRes.json();
    expect(body.status).toBe('shutdown_queued');
    expect(body.target).toBe('GS-Orchestrator');

    // Poll signal queue for GS-Orchestrator
    const signalsRes = await request.get(`${PROCESS_SERVER_URL}/api/process/signals?projectName=GS-Orchestrator`);
    expect(signalsRes.status()).toBe(200);

    const signalsBody = await signalsRes.json();
    expect(signalsBody.signals.length).toBeGreaterThan(0);

    const shutdownSignal = signalsBody.signals.find((s: any) => s.action === 'SHUTDOWN');
    expect(shutdownSignal).toBeDefined();
  });
});
