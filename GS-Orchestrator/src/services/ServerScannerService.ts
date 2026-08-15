import * as fs from 'fs';
import * as path from 'path';
import { UnregisteredServer, UnregisteredServersData } from '../domain/ServerScannerTypes';
import { RegistryService } from './RegistryService';

export class ServerScannerService {
  private filePath: string;
  private registry: RegistryService;
  private intervalTimer?: NodeJS.Timeout;

  constructor(filePath: string, registry: RegistryService) {
    this.filePath = filePath;
    this.registry = registry;
    this.ensureFileExists();
  }

  /**
   * Start periodic background scan every 30 seconds
   */
  public startPeriodicScan(intervalMs: number = 30000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.scanRunningServers().catch((err) => {
        console.error('Error during periodic server scan:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic background scan
   */
  public stopPeriodicScan(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }

  /**
   * Ensure file and parent directory exist on disk
   */
  private ensureFileExists(): UnregisteredServersData {
    const defaultData: UnregisteredServersData = {
      lastScanned: new Date().toISOString(),
      servers: [],
    };

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2));
        return defaultData;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return defaultData;
    }
  }

  /**
   * Scan running servers using local registry state
   */
  public async scanRunningServers(): Promise<UnregisteredServer[]> {
    const data = this.loadData();
    return data.servers || [];
  }

  /**
   * Read current unregistered servers from disk
   */
  public loadData(): UnregisteredServersData {
    return this.ensureFileExists();
  }

  /**
   * Save detected unregistered servers to disk
   */
  private saveData(servers: UnregisteredServer[]): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data: UnregisteredServersData = {
        lastScanned: new Date().toISOString(),
        servers,
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error saving unregistered servers file:', err);
    }
  }
}
