import * as fs from 'fs';
import * as path from 'path';

interface Signal {
  type: 'kill' | 'restart' | 'update';
  projectName: string;
  timestamp: string;
  processed: boolean;
}

const SIGNALS_FILE = path.join(__dirname, '..', '..', 'signals.json');

export class SignalService {
  private signals: Signal[] = [];

  constructor() {
    this.loadSignals();
  }

  private loadSignals(): void {
    try {
      if (fs.existsSync(SIGNALS_FILE)) {
        const data = fs.readFileSync(SIGNALS_FILE, 'utf-8');
        this.signals = JSON.parse(data);
      } else {
        this.signals = [];
      }
    } catch (err) {
      console.error('Error loading signals:', err);
      this.signals = [];
    }
  }

  private saveSignals(): void {
    try {
      fs.writeFileSync(SIGNALS_FILE, JSON.stringify(this.signals, null, 2));
    } catch (err) {
      console.error('Error saving signals:', err);
    }
  }

  queueSignal(type: 'kill' | 'restart' | 'update', projectName: string): void {
    const signal: Signal = {
      type,
      projectName,
      timestamp: new Date().toISOString(),
      processed: false,
    };
    this.signals.push(signal);
    this.saveSignals();
    console.log(`✉️ Signal queued: ${type} for project ${projectName}`);
  }

  getSignalsForProject(projectName: string): Signal[] {
    return this.signals.filter((s) => s.projectName === projectName && !s.processed);
  }

  markSignalsProcessed(projectName: string): void {
    this.signals.forEach((s) => {
      if (s.projectName === projectName && !s.processed) {
        s.processed = true;
      }
    });
    this.saveSignals();
  }

  getAllSignals(): Signal[] {
    return this.signals;
  }

  clearProcessedSignals(): void {
    this.signals = this.signals.filter((s) => !s.processed);
    this.saveSignals();
  }
}

export const signalService = new SignalService();
