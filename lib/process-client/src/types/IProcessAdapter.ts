export interface SubSystemInfo {
  port: number;
  status: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped' | string;
  pid?: number | null;
  error?: string;
}

export interface IProcessStatus {
  projectName: string;
  status: 'STOPPED' | 'RUNNING' | 'ERROR';
  pid?: number | null;
  components?: Record<string, SubSystemInfo>;
}

export interface IProcessAdapter {
  start(ports?: { [key: string]: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<IProcessStatus>;
}
