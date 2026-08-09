import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService, AppState } from '../../services/app-state.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavBarComponent implements OnInit {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' = 'home';
  projectsCount = 0;
  unregisteredCount = 0;

  constructor(private appState: AppStateService) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      this.projectsCount = state.projectsList.length;
      this.unregisteredCount = state.unregisteredServers.length;
    });
  }

  setTab(tab: 'home' | 'projects' | 'register' | 'unregistered' | 'health'): void {
    this.appState.setActiveTab(tab);
  }
}
