import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrchestratorService, ProjectEntry, UnregisteredServer } from './orchestrator.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' = 'home';
  healthStatus = 'Loading...';
  orchestratorPort = 9000;
  registeredCount = 0;
  unregisteredServers: UnregisteredServer[] = [];

  // Form Model: Registration
  regProjectName = '';
  regProjectPath = '';
  regBackendType = 'node-ts';
  regFrontendType = 'angular';
  registrationAlert = '';

  // Form Model: Health Simulator
  healthProjectName = 'GS-Orchestrator';
  healthStatusOption = 'ok';
  healthUptime = 3600;
  healthAlert = '';

  // Mock registered projects list for table display
  projectsList: ProjectEntry[] = [];

  constructor(private orchestratorService: OrchestratorService) {}

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.orchestratorService.getHealth().subscribe({
      next: (res: any) => {
        this.healthStatus = res.status || 'Healthy';
        this.orchestratorPort = res.port || 9000;
      },
      error: () => {
        this.healthStatus = 'Degraded / Offline';
      }
    });

    this.orchestratorService.getRegistry().subscribe({
      next: (res: any) => {
        const projectsObj = res.projects || {};
        this.projectsList = Object.values(projectsObj);
        this.registeredCount = Object.keys(projectsObj).length;
      },
      error: () => {
        this.projectsList = [];
        this.registeredCount = 0;
      }
    });

    this.orchestratorService.getUnregisteredServers().subscribe({
      next: (res: any) => {
        this.unregisteredServers = res.servers || [];
      },
      error: () => {
        this.unregisteredServers = [];
      }
    });
  }

  submitRegistration(): void {
    if (!this.regProjectName || !this.regProjectPath) {
      return;
    }

    const payload = {
      projectName: this.regProjectName,
      path: this.regProjectPath,
      serviceTypes: {
        backend: this.regBackendType,
        frontend: this.regFrontendType
      }
    };

    this.orchestratorService.registerProject(payload).subscribe({
      next: (res: any) => {
        this.registrationAlert = `Project '${this.regProjectName}' registered successfully! Ticket: ${res.ticket || 'N/A'}`;
        this.refreshData();
      },
      error: (err: any) => {
        this.registrationAlert = `Registration failed: ${err.message || 'Error'}`;
      }
    });
  }

  submitHealthPing(): void {
    if (!this.healthProjectName) return;

    const payload = {
      projectName: this.healthProjectName,
      health: {
        status: this.healthStatusOption,
        uptimeSeconds: Number(this.healthUptime)
      }
    };

    this.orchestratorService.sendHealthReport(payload).subscribe({
      next: () => {
        this.healthAlert = `Health report received for ${this.healthProjectName}!`;
        this.refreshData();
      },
      error: () => {
        this.healthAlert = `Failed to send health report.`;
      }
    });
  }

  getComponentEntries(components: Record<string, number>): string {
    if (!components) return 'None';
    return Object.entries(components)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }

  setActiveTab(tab: 'home' | 'projects' | 'register' | 'unregistered' | 'health'): void {
    this.activeTab = tab;
  }

  unregisterProject(projectName: string): void {
    if (confirm(`Are you sure you want to unregister project "${projectName}"?`)) {
      this.orchestratorService.unregisterProject(projectName).subscribe({
        next: () => {
          alert(`Project "${projectName}" has been unregistered successfully.`);
          this.refreshData();
        },
        error: (err: any) => {
          alert(`Failed to unregister project: ${err.error?.error || 'Unknown error'}`);
        }
      });
    }
  }
}
