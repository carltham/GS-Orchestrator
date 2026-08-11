import { test, expect } from '@playwright/test';

test.describe('ProcessServer (:9999) - Installers Suite', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

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
});
