import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService, AppState } from '../../../services/app-state.service';
import { OrchestratorService, ProjectEntry } from '../../../orchestrator.service';
import { StateModalComponent } from '../../modals/state-modal/state-modal.component';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, StateModalComponent],
  templateUrl: './projects-page.component.html',
  styleUrls: ['./projects-page.component.css']
})
export class ProjectsPageComponent implements OnInit {
  activeTab: string = 'projects';
  projectsList: ProjectEntry[] = [];
  showStateModal = false;
  selectedProject: ProjectEntry | null = null;

  constructor(
    private appState: AppStateService,
    private orchestratorService: OrchestratorService
  ) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      this.projectsList = state.projectsList;
    });
  }

  getComponentEntries(components: Record<string, number>): string {
    return Object.entries(components)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }

  openStateModal(project: ProjectEntry): void {
    this.selectedProject = project;
    this.showStateModal = true;
  }

  closeStateModal(): void {
    this.showStateModal = false;
    this.selectedProject = null;
  }

  onStopProject(): void {
    if (!this.selectedProject) return;

    const projectName = this.selectedProject.name;
    if (!confirm(`Are you sure you want to stop project "${projectName}"?`)) {
      return;
    }

    this.orchestratorService.unregisterProject(projectName).subscribe({
      next: (res: any) => {
        alert(`Project "${projectName}" is now stopping. Stop signal sent to client.`);
        this.closeStateModal();
        setTimeout(() => this.refresh(), 500);
      },
      error: (err: any) => {
        alert(`Failed to stop project: ${err.error?.error || 'Unknown error'}`);
      }
    });
  }

  onRestartProject(): void {
    if (!this.selectedProject) return;
    alert(`Restart functionality coming soon for project "${this.selectedProject.name}"`);
    this.closeStateModal();
  }

  refresh(): void {
    window.dispatchEvent(new CustomEvent('refreshData'));
  }
}
