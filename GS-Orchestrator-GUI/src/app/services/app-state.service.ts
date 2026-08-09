import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProjectEntry, UnregisteredServer } from '../orchestrator.service';

export interface AppState {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users';
  healthStatus: string;
  orchestratorPort: number;
  projectsList: ProjectEntry[];
  unregisteredServers: UnregisteredServer[];
}

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private initialState: AppState = {
    activeTab: 'home',
    healthStatus: 'Loading...',
    orchestratorPort: 9000,
    projectsList: [],
    unregisteredServers: []
  };

  private state = new BehaviorSubject<AppState>(this.initialState);
  public state$: Observable<AppState> = this.state.asObservable();

  constructor() {}

  getState(): AppState {
    return this.state.value;
  }

  setActiveTab(tab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users'): void {
    this.updateState({ activeTab: tab });
  }

  setHealthStatus(status: string): void {
    this.updateState({ healthStatus: status });
  }

  setOrchestratorPort(port: number): void {
    this.updateState({ orchestratorPort: port });
  }

  setProjectsList(projects: ProjectEntry[]): void {
    this.updateState({ projectsList: projects });
  }

  setUnregisteredServers(servers: UnregisteredServer[]): void {
    this.updateState({ unregisteredServers: servers });
  }

  private updateState(partial: Partial<AppState>): void {
    const current = this.state.value;
    this.state.next({ ...current, ...partial });
  }
}
