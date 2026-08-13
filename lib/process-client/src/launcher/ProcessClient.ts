import { ClientState, ProcessClientConfig } from '../models/ClientState';
import { LoggerView } from '../views/LoggerView';
import { TelemetryView } from '../views/TelemetryView';
import { LauncherController } from '../controllers/LauncherController';

export { ProcessClientConfig } from '../models/ClientState';

export class ProcessClient {
  private state: ClientState;
  private logger: LoggerView;
  private telemetry: TelemetryView;
  private controller: LauncherController;

  constructor(config: ProcessClientConfig) {
    this.state = new ClientState(config);
    this.logger = new LoggerView(this.state);
    this.telemetry = new TelemetryView(this.state);
    this.controller = new LauncherController(this.state, this.logger, this.telemetry);
  }

  public async start(): Promise<void> {
    await this.controller.start();
  }

  public async stop(): Promise<void> {
    await this.controller.stop();
  }

  public setPollIntervalMs(ms: number): void {
    this.controller.setPollIntervalMs(ms);
  }

  public setHeartbeatIntervalMs(ms: number): void {
    this.controller.setHeartbeatIntervalMs(ms);
  }
}
export default ProcessClient;
