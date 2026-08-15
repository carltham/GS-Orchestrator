import * as fs from 'fs';
import * as path from 'path';

export interface ProcessServerRules {
  preventStop: boolean;
  preventUnregister: boolean;
  preventMarkStopped: boolean;
}

export interface ProcessServerErrorMessages {
  missingProjectName: string;
  missingRequiredFields: string;
  missingHealthProjectName: string;
  projectNotFound: string;
  healthProjectNotFound: string;
  cannotStopSelf: string;
  cannotMarkStoppedSelf: string;
  unregisterFailed: string;
  restartFailed: string;
  stopConfirmationFailed: string;
  registrationFailed: string;
  healthReportFailed: string;
}

export interface SystemConfig {
  protectedServices: string[];
  rules: ProcessServerRules;
  errorMessages: ProcessServerErrorMessages;
}

export class SystemConfigService {
  private static instance: SystemConfigService;
  private config: SystemConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): SystemConfigService {
    if (!SystemConfigService.instance) {
      SystemConfigService.instance = new SystemConfigService();
    }
    return SystemConfigService.instance;
  }

  private loadConfig(): SystemConfig {
    const candidates = [
      path.resolve(process.cwd(), 'config', 'sys-config.json'),
      path.resolve(process.cwd(), '..', 'config', 'sys-config.json'),
      path.resolve(process.cwd(), '..', '..', 'config', 'sys-config.json'),
      path.resolve(__dirname, '..', '..', '..', '..', 'config', 'sys-config.json'),
      path.resolve(__dirname, '..', '..', '..', 'config', 'sys-config.json')
    ];

    for (const configPath of candidates) {
      if (fs.existsSync(configPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (raw.orchestrator) {
            return raw.orchestrator;
          }
        } catch {
          // fallback to defaults if parse fails
        }
      }
    }

    return {
      protectedServices: ['GS-Orchestrator'],
      rules: {
        preventStop: true,
        preventUnregister: true,
        preventMarkStopped: true
      },
      errorMessages: {
        missingProjectName: 'Missing required parameter: projectName',
        missingRequiredFields: 'Missing required fields: projectName, path',
        missingHealthProjectName: 'Missing required field: projectName',
        projectNotFound: 'Project "{projectName}" not found in registry',
        healthProjectNotFound: 'Project "{projectName}" not found',
        cannotStopSelf: 'Cannot stop or unregister the main Orchestrator service "{projectName}" itself, as it is the central administration hub.',
        cannotMarkStoppedSelf: 'The main Orchestrator service "{projectName}" is permanently active and cannot be set to stopped.',
        unregisterFailed: 'Failed to unregister project',
        restartFailed: 'Failed to restart project',
        stopConfirmationFailed: 'Failed to confirm project stopped',
        registrationFailed: 'Failed to register project',
        healthReportFailed: 'Failed to process health report'
      }
    };
  }

  public isProtectedService(projectName: string): boolean {
    return this.config.protectedServices.includes(projectName);
  }

  public getRules(): ProcessServerRules {
    return this.config.rules;
  }

  public formatError(key: keyof ProcessServerErrorMessages, params: Record<string, string> = {}): string {
    let msg = this.config.errorMessages[key] || '';
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return msg;
  }
}
