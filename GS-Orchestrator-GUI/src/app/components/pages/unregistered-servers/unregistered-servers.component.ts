import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService, AppState } from '../../../services/app-state.service';
import { UnregisteredServer } from '../../../orchestrator.service';

@Component({
  selector: 'app-unregistered-servers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unregistered-servers.component.html',
  styleUrls: ['./unregistered-servers.component.css']
})
export class UnregisteredServersComponent implements OnInit {
  activeTab: 'home' | 'projects' | 'register' | 'unregistered' | 'health' = 'unregistered';
  unregisteredServers: UnregisteredServer[] = [];

  constructor(private appState: AppStateService) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      this.unregisteredServers = state.unregisteredServers;
    });
  }
}
