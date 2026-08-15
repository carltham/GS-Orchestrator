import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService, AppState } from '../../services/app-state.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavBarComponent implements OnInit {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users' = 'home';
  projectsCount = 0;
  unregisteredCount = 0;
  isSuperAdmin = false;

  constructor(
    private appState: AppStateService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      this.projectsCount = state.projectsList.length;
      this.unregisteredCount = state.unregisteredServers.length;
    });

    this.authService.currentUser$.subscribe(user => {
      this.isSuperAdmin = user?.role === 'SUPERADMIN';
    });
  }

  setTab(tab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' | 'users'): void {
    this.appState.setActiveTab(tab);
  }
}
