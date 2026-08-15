import express, { Express, Request, Response } from 'express';
import * as http from 'http';

export interface RecordedRequest {
  timestamp: string;
  method: string;
  url: string;
  path: string;
  query: Record<string, any>;
  headers: Record<string, any>;
  body: any;
}

export interface QueuedSignal {
  id: string;
  action: 'START' | 'STOP' | 'RESTART' | 'DELETE';
  ports?: Record<string, number>;
  timestamp?: string;
}

export class MockProcessServer {
  private app: Express;
  private server: http.Server | null = null;
  public readonly port: number;
  private requests: RecordedRequest[] = [];
  private signalQueues: Map<string, QueuedSignal[]> = new Map();
  private mockPortAllocations: Record<string, number> = {
    backend: 3000,
    frontend: 4200,
  };

  constructor(port: number = 9998) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private recordRequest(req: Request): void {
    this.requests.push({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body,
    });
  }

  private setupRoutes(): void {
    // Middleware to log all incoming requests
    this.app.use((req, res, next) => {
      this.recordRequest(req);
      next();
    });

    // Registration endpoint
    this.app.post('/ps/project/register', (req: Request, res: Response) => {
      const { projectName } = req.body;
      res.status(200).json({
        success: true,
        projectName,
        ports: this.mockPortAllocations,
        status: 'registered',
      });
    });

    // Telemetry / Heartbeat endpoint
    this.app.post('/ps/process/heartbeat', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        received: true,
        timestamp: new Date().toISOString(),
      });
    });

    // Ticket / Signal polling endpoint
    this.app.get('/ps/process/signals', (req: Request, res: Response) => {
      const projectName = (req.query.projectName as string) || '';
      const queue = this.signalQueues.get(projectName) || [];
      // Drain the queued signals for the client
      this.signalQueues.set(projectName, []);
      res.status(200).json({
        success: true,
        signals: queue,
      });
    });

    // Enqueue signal endpoint (or programmatic)
    this.app.post('/ps/process/signals', (req: Request, res: Response) => {
      const { target, action, ports } = req.body;
      this.queueSignal(target, {
        id: `sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        action,
        ports,
      });
      res.status(201).json({ success: true, message: 'Signal queued' });
    });
  }

  /**
   * Push a signal/ticket to the queue for a target project
   */
  public queueSignal(projectName: string, signal: QueuedSignal): void {
    const queue = this.signalQueues.get(projectName) || [];
    queue.push(signal);
    this.signalQueues.set(projectName, queue);
  }

  /**
   * Start the mock server on specified port
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        resolve();
      });
    });
  }

  /**
   * Stop the mock server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get all recorded client requests
   */
  public getRequests(): RecordedRequest[] {
    return [...this.requests];
  }

  /**
   * Get requests filtered by path
   */
  public getRequestsByPath(pathPrefix: string): RecordedRequest[] {
    return this.requests.filter((r) => r.path.startsWith(pathPrefix));
  }

  /**
   * Get all signal/ticket polling requests
   */
  public getSignalPolls(): RecordedRequest[] {
    return this.requests.filter((r) => r.path === '/ps/process/signals' && r.method === 'GET');
  }

  /**
   * Get all telemetry heartbeats
   */
  public getHeartbeats(): RecordedRequest[] {
    return this.requests.filter((r) => r.path === '/ps/process/heartbeat' && r.method === 'POST');
  }

  /**
   * Get all registration posts
   */
  public getRegistrations(): RecordedRequest[] {
    return this.requests.filter((r) => r.path === '/ps/project/register' && r.method === 'POST');
  }

  /**
   * Clear recorded logs and queues
   */
  public clearLogs(): void {
    this.requests = [];
    this.signalQueues.clear();
  }

  public get url(): string {
    return `http://localhost:${this.port}`;
  }
}
