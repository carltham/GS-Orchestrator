/**
 * ProcessAdapter.js
 * Generated dynamically by ProcessServer on 2026-08-11T07:38:08.959Z
 * Target Project: gs-orchestrator
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProcessAdapter {
  constructor() {
    this.projectName = "gs-orchestrator";
    this.processes = {};
    this.status = 'STOPPED';
  }

  /**
   * Main entry point to start all project components
   * @param {Object} ports Allocated ports for the target service
   */
  async start(ports = {}) {
    if (this.status === 'RUNNING') {
      console.log(`[ProcessAdapter] ${this.projectName} is already running.`);
      return;
    }

    console.log(`[ProcessAdapter] Starting component services for ${this.projectName}...`);
    const env = { ...process.env, ...ports };

    if (fs.existsSync(path.join(__dirname, 'GS-Orchestrator', 'package.json'))) {
      await this.startOrchestratorServer(env);
    } else {
      await this.startNodeComponent(env);
    }

    this.status = 'RUNNING';
  }

  /**
   * Component Launcher: GS-Orchestrator Backend Server
   */
  async startOrchestratorServer(env = {}) {
    console.log('[ProcessAdapter] Launching component: GS-Orchestrator Server...');
    const proc = spawn('npm', ['--prefix', 'GS-Orchestrator', 'run', 'dev'], {
      cwd: __dirname,
      env,
      stdio: 'inherit',
      shell: true
    });

    this.processes['server'] = proc;
    this.bindProcessEvents('server', proc);
  }

  /**
   * Component Launcher: Standard Node.js Application
   */
  async startNodeComponent(env = {}) {
    console.log(`[ProcessAdapter] Launching component: ${this.projectName}...`);
    const proc = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      env,
      stdio: 'inherit',
      shell: true
    });

    this.processes[this.projectName] = proc;
    this.bindProcessEvents(this.projectName, proc);
  }

  /**
   * Bind lifecycle listeners to spawned child processes
   */
  bindProcessEvents(name, proc) {
    proc.on('exit', (code, signal) => {
      console.log(`[ProcessAdapter] Component '${name}' exited with code ${code}, signal ${signal}`);
      delete this.processes[name];
      if (Object.keys(this.processes).length === 0) {
        this.status = 'STOPPED';
      }
    });

    proc.on('error', (err) => {
      console.error(`[ProcessAdapter] Component '${name}' process error: ${err.message}`);
      this.status = 'ERROR';
    });
  }

  /**
   * Stop all component services
   */
  async stop() {
    console.log(`[ProcessAdapter] Stopping all components for ${this.projectName}...`);
    for (const [name, proc] of Object.entries(this.processes)) {
      if (proc) {
        console.log(`[ProcessAdapter] Killing component process: ${name}`);
        proc.kill('SIGTERM');
      }
    }
    this.processes = {};
    this.status = 'STOPPED';
  }

  /**
   * Get overall process status and PIDs
   */
  async getStatus() {
    const pids = {};
    for (const [name, proc] of Object.entries(this.processes)) {
      pids[name] = proc ? proc.pid : null;
    }

    return {
      projectName: this.projectName,
      status: this.status,
      components: pids
    };
  }
}

module.exports = ProcessAdapter;
