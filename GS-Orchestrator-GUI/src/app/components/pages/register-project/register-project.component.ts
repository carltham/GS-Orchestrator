import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService, AppState } from '../../../services/app-state.service';
import { OrchestratorService } from '../../../orchestrator.service';

@Component({
  selector: 'app-register-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-project.component.html',
  styleUrls: ['./register-project.component.css']
})
export class RegisterProjectComponent implements OnInit {
  activeTab: string = 'register';
  projectName = '';
  projectPath = '';
  backendType = 'node-ts';
  frontendType = 'angular';
  registrationAlert = '';

  constructor(
    private appState: AppStateService,
    private orchestratorService: OrchestratorService
  ) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
    });
  }

  submitRegistration(): void {
    if (!this.projectName || !this.projectPath) {
      return;
    }

    const payload = {
      projectName: this.projectName,
      path: this.projectPath,
      serviceTypes: {
        backend: this.backendType,
        frontend: this.frontendType,
      },
    };

    this.orchestratorService.registerProject(payload).subscribe({
      next: (res: any) => {
        this.registrationAlert = `✅ Project "${this.projectName}" registered successfully with ports: Backend ${res.ports?.backend}, Frontend ${res.ports?.frontend}`;
        this.projectName = '';
        this.projectPath = '';
        this.backendType = 'node-ts';
        this.frontendType = 'angular';
        setTimeout(() => this.refreshProjects(), 1000);
      },
      error: (err: any) => {
        this.registrationAlert = `❌ Error: ${err.error?.error || 'Failed to register project'}`;
      }
    });
  }

  private refreshProjects(): void {
    window.dispatchEvent(new CustomEvent('refreshData'));
  }
}
