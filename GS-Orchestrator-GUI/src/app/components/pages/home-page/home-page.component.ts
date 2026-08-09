import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService, AppState } from '../../../services/app-state.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' = 'home';
  projectsList: any[] = [];
  orchestratorPort = 9000;
  unregisteredServers: any[] = [];

  constructor(private appState: AppStateService) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      this.projectsList = state.projectsList;
      this.orchestratorPort = state.orchestratorPort;
      this.unregisteredServers = state.unregisteredServers;
    });
  }

  refresh(): void {
    // Will trigger parent refresh
    window.dispatchEvent(new CustomEvent('refreshData'));
  }
}
