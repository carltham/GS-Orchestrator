export interface InspectionPayload {
  workspaceDir: string;
  projectName: string;
  hasPackageJson: boolean;
  timestamp?: string;
  startScript?: string;
}

export function generateProcessAdapter(payload: InspectionPayload): string {
  const projectName = payload.projectName || 'unknown-project';

  return `/**
 * ProcessAdapter.js
 * Generated dynamically by ProcessServer on ${new Date().toISOString()}
 * Target Project: ${projectName}
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProcessAdapter {
  constructor() {
    this.projectName = ${JSON.stringify(projectName)};
    this.processes = {};
    this.status = 'STOPPED';
    this.logDir = path.resolve(process.cwd(), 'logs');
    this.logFilePath = path.join(this.logDir, 'process-adapter.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error(\`[ProcessAdapter] Failed to create log directory: \${err.message}\`);
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const formatted = \`[\${timestamp}] [\${level}] [ProcessAdapter:\${this.projectName}] \${message}\\n\`;
    console.log(\`[ProcessAdapter] \${message}\`);
    try {
      this.ensureLogDirectory();
      fs.appendFileSync(this.logFilePath, formatted, 'utf8');
    } catch (err) {
      console.error(\`[ProcessAdapter] Log write failed: \${err.message}\`);
    }
  }

  /**
   * Main entry point to start all project components
   * @param {Object} ports Allocated ports for the target service
   */
  async start(ports = {}) {
    if (this.status === 'RUNNING') {
      this.log(\`\${this.projectName} is already running.\`, 'WARN');
      return;
    }

    this.log(\`Starting component services for \${this.projectName}...\`);
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
    this.log('Launching component: GS-Orchestrator Server...');
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
    this.log(\`Launching component: \${this.projectName}...\`);
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
      this.log(\`Component '\${name}' exited with code \${code}, signal \${signal}\`);
      delete this.processes[name];
      if (Object.keys(this.processes).length === 0) {
        this.status = 'STOPPED';
      }
    });

    proc.on('error', (err) => {
      this.log(\`Component '\${name}' process error: \${err.message}\`, 'ERROR');
      this.status = 'ERROR';
    });
  }

  /**
   * Stop all component services
   */
  async stop() {
    this.log(\`Stopping all components for \${this.projectName}...\`);
    for (const [name, proc] of Object.entries(this.processes)) {
      if (proc) {
        this.log(\`Killing component process: \${name}\`);
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
`;
}
