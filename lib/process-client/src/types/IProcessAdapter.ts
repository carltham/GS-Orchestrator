export interface IProcessStatus {
  projectName: string;
  status: 'STOPPED' | 'RUNNING' | 'ERROR';
  pid?: number | null;
}

export interface IProcessAdapter {
  start(ports?: { [key: string]: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<IProcessStatus>;
}
