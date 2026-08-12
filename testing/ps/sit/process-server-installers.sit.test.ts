describe('Process Server (:9999) - Installers SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('GET /install.sh returns valid shell inspector script', async () => {
    const response = await fetch(`${PROCESS_SERVER_URL}/install.sh`);
    expect(response.status).toBe(200);

    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('text/x-shellscript');

    const text = await response.text();
    expect(text).toContain('#!/usr/bin/env bash');
    expect(text).toContain('ProcessAdapter.js');
  });

  test('GET /install.js returns valid Node.js inspector script', async () => {
    const response = await fetch(`${PROCESS_SERVER_URL}/install.js`);
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toContain('ProcessInstaller');
    expect(text).toContain('ProcessAdapter.js');
  });

  test('POST /api/installer/generate compiles runnable ProcessAdapter class', async () => {
    const payload = {
      workspaceDir: '/tmp/test-workspace',
      projectName: 'TestProject',
      hasPackageJson: true,
      startScript: 'npm start'
    };

    const response = await fetch(`${PROCESS_SERVER_URL}/api/installer/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(200);
    const code = await response.text();

    expect(code).toContain('class ProcessAdapter');
    expect(code).toContain('TestProject');
    expect(code).toContain('async start(ports = {})');
    expect(code).toContain('async stop()');
    expect(code).toContain('async getStatus()');
  });
});
