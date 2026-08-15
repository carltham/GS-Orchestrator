import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ProjectEntry, UnregisteredServer } from '../orchestrator.service';
import { getSessionViewState, saveSessionViewState, SessionViewState } from './session-cookie.util';

export interface AppState {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users';
  healthStatus: string;
  orchestratorPort: number;
  projectsList: ProjectEntry[];
  unregisteredServers: UnregisteredServer[];
  viewState: SessionViewState;
}

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  private savedViewState: SessionViewState = getSessionViewState();

  private initialState: AppState = {
    activeTab: this.savedViewState.activeTab || 'home',
    healthStatus: 'Loading...',
    orchestratorPort: 10000,
    projectsList: [],
    unregisteredServers: [],
    viewState: this.savedViewState
  };

  private state = new BehaviorSubject<AppState>(this.initialState);
  public state$: Observable<AppState> = this.state.asObservable();

  private refreshRequestSubject = new Subject<void>();
  public refreshRequested$: Observable<void> = this.refreshRequestSubject.asObservable();

  constructor() {}

  requestRefresh(): void {
    this.refreshRequestSubject.next();
  }

  getState(): AppState {
    return this.state.value;
  }

  setActiveTab(tab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users'): void {
    this.updateViewState({ activeTab: tab });
    this.updateState({ activeTab: tab });
  }

  updateViewState(partialView: Partial<SessionViewState>): void {
    saveSessionViewState(partialView);
    const current = this.state.value;
    const newViewState = { ...current.viewState, ...partialView };
    this.state.next({ ...current, viewState: newViewState });
  }

  getViewState(): SessionViewState {
    return this.state.value.viewState;
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
