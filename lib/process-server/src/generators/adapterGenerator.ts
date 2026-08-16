export interface ComponentCommand {
  executable: string;
  args: string[];
}

export interface InspectedComponent {
  name: string;
  relativePath: string;
  serviceType: 'backend' | 'frontend' | 'database' | 'service';
  command: ComponentCommand;
  stopCommand?: ComponentCommand;
  configuredPort?: number;
}

export interface InspectionPayload {
  workspaceDir: string;
  projectName: string;
  hasPackageJson: boolean;
  timestamp?: string;
  components: InspectedComponent[];
}

export function generateProcessAdapter(payload: InspectionPayload): string {
  const projectName = payload.projectName || 'unknown-project';
  const components = Array.isArray(payload.components) ? payload.components : [];

  return `/**
 * ProcessAdapter.js
 * Generated dynamically by ProcessServer on ${new Date().toISOString()}
 * Target Project: ${projectName}
 */

const { spawn } = require('child_process');
const path = require('path');

class ProcessAdapter {
  constructor() {
    this.projectName = ${JSON.stringify(projectName)};
    this.componentDefinitions = ${JSON.stringify(components, null, 2)};
    this.processes = {};
    this.status = 'STOPPED';
    this.ports = {};
  }

  getServiceTypes() {
    return Object.fromEntries(
      this.componentDefinitions.map((component) => [component.name, component.serviceType])
    );
  }

  getConfiguredPorts() {
    return Object.fromEntries(
      this.componentDefinitions
        .filter((component) => Number.isInteger(component.configuredPort))
        .map((component) => [component.name, component.configuredPort])
    );
  }

  async start(ports = {}) {
    if (this.status === 'RUNNING') return;

    this.ports = ports;
    for (const component of this.componentDefinitions) {
      if (this.processes[component.name]) continue;

      const assignedPort = ports[component.name] ?? component.configuredPort;
      const portEnvironment = Object.fromEntries(
        Object.entries(ports).map(([name, port]) => [\`\${name.toUpperCase()}_PORT\`, String(port)])
      );
      const executable = process.platform === 'win32' && component.command.executable === 'npm'
        ? 'npm.cmd'
        : component.command.executable;
      const processHandle = spawn(executable, component.command.args, {
        cwd: path.resolve(__dirname, component.relativePath),
        env: {
          ...process.env,
          ...portEnvironment,
          ...(assignedPort ? { PORT: String(assignedPort) } : {})
        },
        stdio: 'inherit'
      });

      this.processes[component.name] = processHandle;
      processHandle.on('exit', () => {
        if (this.processes[component.name] !== processHandle) return;
        delete this.processes[component.name];
        if (Object.keys(this.processes).length === 0) this.status = 'STOPPED';
      });
      processHandle.on('error', () => {
        if (this.processes[component.name] === processHandle) {
          delete this.processes[component.name];
        }
        this.status = 'ERROR';
      });
    }

    this.status = 'RUNNING';
  }

  async stop() {
    for (const component of this.componentDefinitions) {
      const processHandle = this.processes[component.name];
      if (component.stopCommand) {
        await this.runStopCommand(component);
      } else if (processHandle) {
        processHandle.kill('SIGTERM');
      }
    }
    this.processes = {};
    this.status = 'STOPPED';
  }

  async runStopCommand(component) {
    const executable = process.platform === 'win32' && component.stopCommand.executable === 'npm'
      ? 'npm.cmd'
      : component.stopCommand.executable;
    await new Promise((resolve, reject) => {
      const processHandle = spawn(executable, component.stopCommand.args, {
        cwd: path.resolve(__dirname, component.relativePath),
        env: process.env,
        stdio: 'inherit'
      });
      processHandle.once('error', reject);
      processHandle.once('exit', (code) => code === 0 ? resolve() : reject(new Error(
        \`Stop command for \${component.name} exited with code \${code}\`
      )));
    });
  }

  async getStatus() {
    const components = {};
    for (const component of this.componentDefinitions) {
      const processHandle = this.processes[component.name];
      components[\`\${component.name}::\${component.serviceType}\`] = {
        port: this.ports[component.name] ?? component.configuredPort,
        status: processHandle ? 'running' : 'stopped',
        pid: processHandle?.pid || null
      };
    }
    return { projectName: this.projectName, status: this.status, components };
  }
}

module.exports = ProcessAdapter;
`;
}
