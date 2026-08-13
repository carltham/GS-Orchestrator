import * as fs from 'fs';
import { ClientState } from '../models/ClientState';

export class LoggerView {
  private state: ClientState;

  constructor(state: ClientState) {
    this.state = state;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.state.logDir)) {
        fs.mkdirSync(this.state.logDir, { recursive: true });
      }
    } catch (err: any) {
      console.error(`[ProcessClient:LoggerView] Failed to create log directory: ${err.message}`);
    }
  }

  public log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [ProcessClient:${this.state.projectName}] ${message}\n`;
    
    console.log(`[ProcessClient] ${message}`);
    
    try {
      this.ensureLogDirectory();
      fs.appendFileSync(this.state.logFilePath, formatted, 'utf8');
    } catch (err: any) {
      console.error(`[ProcessClient:LoggerView] Log write failed: ${err.message}`);
    }
  }
}
