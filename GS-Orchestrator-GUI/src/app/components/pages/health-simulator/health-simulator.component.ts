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
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' = 'health';
  projectName = 'GS-Orchestrator';
  statusOption = 'ok';
  uptime = 3600;
  healthAlert = '';

  constructor(
    private appState: AppStateService,
    private orchestratorService: OrchestratorService
  ) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
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
