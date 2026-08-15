import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService, AppState } from '../../../services/app-state.service';
import { OrchestratorService, ProjectEntry } from '../../../orchestrator.service';
import { DialogService } from '../../../services/dialog.service';
import { StateModalComponent } from '../../modals/state-modal/state-modal.component';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, StateModalComponent],
  templateUrl: './projects-page.component.html',
  styleUrls: ['./projects-page.component.css']
})
export class ProjectsPageComponent implements OnInit {
  activeTab: string = 'projects';
  projectsList: ProjectEntry[] = [];
  searchTerm: string = '';
  statusFilter: string = 'all';
  showStateModal = false;
  selectedProject: ProjectEntry | null = null;

  constructor(
    private appState: AppStateService,
    private orchestratorService: OrchestratorService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    const saved = this.appState.getViewState();
    if (saved.projectsSearch !== undefined) {
      this.searchTerm = saved.projectsSearch;
    }
    if (saved.projectsStatusFilter !== undefined) {
      this.statusFilter = saved.projectsStatusFilter;
    }

    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      this.projectsList = state.projectsList;
    });
  }

  onSearchChange(): void {
    this.appState.updateViewState({ projectsSearch: this.searchTerm });
  }

  onFilterChange(): void {
    this.appState.updateViewState({ projectsStatusFilter: this.statusFilter });
  }

  get filteredProjects(): ProjectEntry[] {
    return this.projectsList.filter(p => {
      const matchesSearch = !this.searchTerm || 
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.path.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesStatus = this.statusFilter === 'all' || 
        (p.status || 'running') === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  getComponentEntries(components: Record<string, any>): string {
    return Object.entries(components)
      .map(([k, info]) => `${k} (Port: ${info.port || 'N/A'}, PID: ${info.pid || 'N/A'}, Status: ${info.status || 'unknown'})`)
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

  async onStopProject(): Promise<void> {
    if (!this.selectedProject) return;

    const projectName = this.selectedProject.name;
    const confirmed = await this.dialogService.confirm(
      `Are you sure you want to stop project "${projectName}"?`,
      'Stop Project'
    );
    if (!confirmed) return;

    this.orchestratorService.stopProject(projectName).subscribe({
      next: async (res: any) => {
        await this.dialogService.alert(
          `Project "${projectName}" is now stopping. Stop signal sent to client.`,
          'Project Stopping'
        );
        this.closeStateModal();
        setTimeout(() => this.appState.requestRefresh(), 500);
      },
      error: async (err: any) => {
        await this.dialogService.alert(
          `Failed to stop project: ${err.error?.error || 'Unknown error'}`,
          'Error'
        );
      }
    });
  }

  async onRemoveProject(): Promise<void> {
    if (!this.selectedProject) return;

    const projectName = this.selectedProject.name;
    const confirmed = await this.dialogService.confirm(
      `Are you sure you want to remove project "${projectName}" from the registry?`,
      'Remove Project'
    );
    if (!confirmed) return;

    this.orchestratorService.unregisterProject(projectName).subscribe({
      next: async (res: any) => {
        await this.dialogService.alert(
          `Project "${projectName}" removed. Delete signal sent to client.`,
          'Project Removed'
        );
        this.closeStateModal();
        setTimeout(() => this.appState.requestRefresh(), 500);
      },
      error: async (err: any) => {
        await this.dialogService.alert(
          `Failed to remove project: ${err.error?.error || 'Unknown error'}`,
          'Error'
        );
      }
    });
  }

  async onRestartProject(): Promise<void> {
    if (!this.selectedProject) return;

    const projectName = this.selectedProject.name;
    const confirmed = await this.dialogService.confirm(
      `Are you sure you want to restart project "${projectName}"?`,
      'Restart Project'
    );
    if (!confirmed) return;

    this.orchestratorService.restartProject(projectName).subscribe({
      next: async (res: any) => {
        await this.dialogService.alert(
          `Project "${projectName}" restart initiated. Start signal sent to client.`,
          'Project Restarting'
        );
        this.closeStateModal();
        setTimeout(() => this.refresh(), 500);
      },
      error: async (err: any) => {
        await this.dialogService.alert(
          `Failed to restart project: ${err.error?.error || 'Unknown error'}`,
          'Error'
        );
      }
    });
  }

  refresh(): void {
    this.appState.requestRefresh();
  }
}
