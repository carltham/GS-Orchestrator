import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService, AppState } from '../../../services/app-state.service';
import { OrchestratorService } from '../../../orchestrator.service';

@Component({
  selector: 'app-health-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './health-simulator.component.html',
  styleUrls: ['./health-simulator.component.css']
})
export class HealthSimulatorComponent implements OnInit {
  activeTab: string = 'health';
  projectName = 'GS-Orchestrator';
  statusOption = 'ok';
  uptime = 3600;
  healthAlert = '';
  availableProjects: string[] = ['GS-Orchestrator'];

  constructor(
    private appState: AppStateService,
    private orchestratorService: OrchestratorService
  ) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      
      // Build project options list
      const projects = new Set<string>();
      projects.add('GS-Orchestrator');
      
      state.projectsList.forEach(p => {
        if (p.name) projects.add(p.name);
      });
      
      state.unregisteredServers.forEach(u => {
        if (u.projectName) {
          projects.add(u.projectName);
        } else if (u.type) {
          projects.add(`${u.type} (Port ${u.port})`);
        } else {
          projects.add(`Port ${u.port}`);
        }
      });

      this.availableProjects = Array.from(projects);
      if (!this.availableProjects.includes(this.projectName) && this.availableProjects.length > 0) {
        this.projectName = this.availableProjects[0];
      }
    });
  }

  sendHealthReport(): void {
    const healthPayload = {
      projectName: this.projectName,
      health: {
        status: this.statusOption,
        uptimeSeconds: this.uptime
      }
    };

    this.orchestratorService.sendHealthReport(healthPayload).subscribe({
      next: () => {
        this.healthAlert = `✅ Health report received for project "${this.projectName}"`;
      },
      error: (err: any) => {
        this.healthAlert = `❌ Error: ${err.error?.error || 'Failed to send health report'}`;
      }
    });
  }
}
