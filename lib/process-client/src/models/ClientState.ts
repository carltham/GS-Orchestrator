import * as fs from 'fs';
import * as path from 'path';
import { IProcessAdapter } from '../types/IProcessAdapter';
import { BeatHolder } from '../utils/BeatHolder';

export interface ProcessClientConfig {
  projectName: string;
  processServerUrl?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  adapter?: IProcessAdapter;
}

export class ClientState {
  public readonly projectName: string;
  public readonly processServerUrl: string;
  public pollIntervalMs: number;
  public heartbeatIntervalMs: number;
  public adapter: IProcessAdapter | null = null;
  public isRunning: boolean = false;
  public isRegistered: boolean = false;

  public metronome: BeatHolder | null = null;

  public readonly logDir: string;
  public readonly logFilePath: string;

  constructor(config: ProcessClientConfig) {
    this.projectName = config.projectName;
    this.processServerUrl = config.processServerUrl || process.env.PROCESS_SERVER_URL || 'http://localhost:9999';

    // Attempt to load operator-set constants from static git-level configuration files
    let filePollIntervalMs: number | undefined;
    let fileHeartbeatIntervalMs: number | undefined;
    try {
      const sysConfigPath = path.resolve(process.cwd(), 'config', 'sys-config.json');
      if (fs.existsSync(sysConfigPath)) {
        const sysRaw = fs.readFileSync(sysConfigPath, 'utf8');
        const sysParsed = JSON.parse(sysRaw);
        if (typeof sysParsed.pollIntervalMs === 'number') {
          filePollIntervalMs = sysParsed.pollIntervalMs;
        }
        if (typeof sysParsed.heartbeatIntervalMs === 'number') {
          fileHeartbeatIntervalMs = sysParsed.heartbeatIntervalMs;
        }
      }
    } catch (err) {
      // Safe fallback
    }

    this.pollIntervalMs = config.pollIntervalMs || filePollIntervalMs || 15000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs || fileHeartbeatIntervalMs || 15000;

    this.logDir = path.resolve(process.cwd(), 'logs');
    this.logFilePath = path.join(this.logDir, 'process-client.log');

    if (config.adapter) {
      this.adapter = config.adapter;
    } else {
      try {
        const AdapterClass = require(path.resolve(process.cwd(), 'ProcessAdapter.js'));
        this.adapter = new AdapterClass();
      } catch (err: any) {
        // Can be initialized programmatically in mock environments/tests
      }
    }
  }
}
