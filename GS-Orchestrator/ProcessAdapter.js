/**
 * ProcessAdapter.js for GS-Orchestrator
 * Connects GS-Orchestrator to ProcessServer (:9999)
 */

const { spawn } = require('child_process');

class ProcessAdapter {
  constructor() {
    this.projectName = 'GS-Orchestrator';
    this.childProcess = null;
    this.status = 'STOPPED';
  }

  /**
   * Start GS-Orchestrator on allocated ports (default 10000)
   * @param {Object} ports Allocated ports map
   */
  async start(ports = {}) {
    if (this.status === 'RUNNING') {
      console.log(`[ProcessAdapter] ${this.projectName} is already running.`);
      return;
    }

    const port = ports.PORT || ports.GS_ORCHESTRATOR_PORT || 10000;
    console.log(`[ProcessAdapter] Starting ${this.projectName} on port ${port}...`);

    const env = { ...process.env, PORT: String(port) };

    this.childProcess = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      env,
      stdio: 'inherit',
      shell: true
    });

    this.status = 'RUNNING';

    this.childProcess.on('exit', (code, signal) => {
      console.log(`[ProcessAdapter] ${this.projectName} exited with code ${code}, signal ${signal}`);
      this.status = 'STOPPED';
      this.childProcess = null;
    });

    this.childProcess.on('error', (err) => {
      console.error(`[ProcessAdapter] Process error: ${err.message}`);
      this.status = 'ERROR';
    });
  }

  /**
   * Stop GS-Orchestrator cleanly
   */
  async stop() {
    if (!this.childProcess || this.status !== 'RUNNING') {
      console.log(`[ProcessAdapter] ${this.projectName} is not running.`);
      this.status = 'STOPPED';
      return;
    }

    console.log(`[ProcessAdapter] Stopping ${this.projectName}...`);
    this.childProcess.kill('SIGTERM');
    this.status = 'STOPPED';
    this.childProcess = null;
  }

  /**
   * Get current GS-Orchestrator process status
   */
  async getStatus() {
    return {
      projectName: this.projectName,
      status: this.status,
      pid: this.childProcess ? this.childProcess.pid : null
    };
  }
}

module.exports = ProcessAdapter;
