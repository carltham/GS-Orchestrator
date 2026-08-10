export interface InspectionPayload {
  workspaceDir: string;
  projectName: string;
  hasPackageJson: boolean;
  timestamp?: string;
  startScript?: string;
}

export function generateProcessAdapter(payload: InspectionPayload): string {
  const projectName = payload.projectName || 'unknown-project';
  const startScript = payload.startScript || 'npm start';

  return `/**
 * ProcessAdapter.js
 * Generated dynamically by ProcessServer on ${new Date().toISOString()}
 * Target Project: ${projectName}
 */

const { spawn } = require('child_process');

class ProcessAdapter {
  constructor() {
    this.projectName = ${JSON.stringify(projectName)};
    this.childProcess = null;
    this.status = 'STOPPED';
  }

  /**
   * Start the target project process
   * @param {Object} ports Allocated ports for the target service
   */
  async start(ports = {}) {
    if (this.status === 'RUNNING') {
      console.log(\`[ProcessAdapter] \${this.projectName} is already running.\`);
      return;
    }

    console.log(\`[ProcessAdapter] Starting \${this.projectName}...\`);
    const env = { ...process.env, ...ports };

    // Execute configured start command
    const commandParts = ${JSON.stringify(startScript)}.split(' ');
    const cmd = commandParts[0];
    const args = commandParts.slice(1);

    this.childProcess = spawn(cmd, args, {
      cwd: __dirname,
      env,
      stdio: 'inherit',
      shell: true
    });

    this.status = 'RUNNING';

    this.childProcess.on('exit', (code, signal) => {
      console.log(\`[ProcessAdapter] \${this.projectName} exited with code \${code}, signal \${signal}\`);
      this.status = 'STOPPED';
      this.childProcess = null;
    });

    this.childProcess.on('error', (err) => {
      console.error(\`[ProcessAdapter] Process error: \${err.message}\`);
      this.status = 'ERROR';
    });
  }

  /**
   * Stop the target project process
   */
  async stop() {
    if (!this.childProcess || this.status !== 'RUNNING') {
      console.log(\`[ProcessAdapter] \${this.projectName} is not running.\`);
      this.status = 'STOPPED';
      return;
    }

    console.log(\`[ProcessAdapter] Stopping \${this.projectName}...\`);
    this.childProcess.kill('SIGTERM');
    this.status = 'STOPPED';
    this.childProcess = null;
  }

  /**
   * Get current process status and PID
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
`;
}
