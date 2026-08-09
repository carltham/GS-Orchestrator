import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from './services/app-state.service';
import { OrchestratorService } from './orchestrator.service';
import { NavBarComponent } from './components/navbar/navbar.component';
import { HomePageComponent } from './components/pages/home-page/home-page.component';
import { ProjectsPageComponent } from './components/pages/projects-page/projects-page.component';
import { RegisterProjectComponent } from './components/pages/register-project/register-project.component';
import { UnregisteredServersComponent } from './components/pages/unregistered-servers/unregistered-servers.component';
import { HealthSimulatorComponent } from './components/pages/health-simulator/health-simulator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavBarComponent,
    HomePageComponent,
    ProjectsPageComponent,
    RegisterProjectComponent,
    UnregisteredServersComponent,
    HealthSimulatorComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  healthStatus = 'Loading...';

  constructor(
    private appState: AppStateService,
    private orchestratorService: OrchestratorService
  ) {}

  ngOnInit(): void {
    this.refreshData();
    
    // Subscribe to health status updates
    this.appState.state$.subscribe(state => {
      this.healthStatus = state.healthStatus;
    });

    // Listen for refresh events from child components
    window.addEventListener('refreshData', () => {
      this.refreshData();
    });
  }

  private refreshData(): void {
    this.orchestratorService.getHealth().subscribe({
      next: (res: any) => {
        this.appState.setHealthStatus(res.status || 'Healthy');
        this.appState.setOrchestratorPort(res.port || 9000);
      },
      error: () => {
        this.appState.setHealthStatus('Degraded / Offline');
      }
    });

    this.orchestratorService.getRegistry().subscribe({
      next: (res: any) => {
        const projectsObj = res.projects || {};
        this.appState.setProjectsList(Object.values(projectsObj));
      },
      error: () => {
        this.appState.setProjectsList([]);
      }
    });

    this.orchestratorService.getUnregisteredServers().subscribe({
      next: (res: any) => {
        this.appState.setUnregisteredServers(res.servers || []);
      },
      error: () => {
        this.appState.setUnregisteredServers([]);
      }
    });
  }
}
