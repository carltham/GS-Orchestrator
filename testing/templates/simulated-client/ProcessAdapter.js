const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

class ProcessAdapter {
  constructor() {
    this.projectName = require(path.join(process.cwd(), 'package.json')).name;
    this.serviceTypes = require(path.join(process.cwd(), 'config', 'simulated-services.json'));
    this.processes = {};
    this.status = 'STOPPED';
    this.ports = {};
  }

  getServiceTypes() {
    return this.serviceTypes;
  }

  async start(ports = {}) {
    if (this.status === 'RUNNING') return;

    this.ports = ports;
    const startedServices = [];
    const serviceFolders = {
      database: 'filedb',
      backend: 'backend',
      frontend: 'frontend'
    };

    for (const serviceName of ['database', 'backend', 'frontend']) {
      const serviceFolder = serviceFolders[serviceName];
      if (!this.serviceTypes[serviceName] || !fs.existsSync(path.join(process.cwd(), serviceFolder))) continue;

      const processHandle = spawn(process.execPath, ['server.js'], {
        cwd: path.join(process.cwd(), serviceFolder),
        env: {
          ...process.env,
          ...ports,
          PORT: String(ports[serviceName])
        },
        stdio: 'inherit'
      });

      this.processes[serviceName] = processHandle;
      startedServices.push(serviceName);
      processHandle.on('exit', () => {
        if (this.processes[serviceName] !== processHandle) return;
        delete this.processes[serviceName];
        if (Object.keys(this.processes).length === 0) this.status = 'STOPPED';
      });
    }

    await Promise.all(startedServices.map((serviceName) => this.waitForHealth(ports[serviceName])));
    this.status = 'RUNNING';
  }

  async waitForHealth(port) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const healthy = await new Promise((resolve) => {
        const request = http.get(`http://localhost:${port}/health`, (response) => {
          response.resume();
          resolve(response.statusCode === 200);
        });
        request.on('error', () => resolve(false));
        request.setTimeout(250, () => {
          request.destroy();
          resolve(false);
        });
      });
      if (healthy) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Service on port ${port} did not become healthy`);
  }

  async stop() {
    for (const processHandle of Object.values(this.processes)) {
      processHandle.kill('SIGTERM');
    }
    this.processes = {};
    this.status = 'STOPPED';
  }

  async getStatus() {
    const components = {};
    for (const [serviceName, serviceType] of Object.entries(this.serviceTypes)) {
      components[`${serviceName}::${serviceType}`] = {
        port: this.ports[serviceName],
        status: this.processes[serviceName] ? 'running' : 'stopped',
        pid: this.processes[serviceName]?.pid || null
      };
    }

    return {
      projectName: this.projectName,
      status: this.status,
      components
    };
  }
}

module.exports = ProcessAdapter;