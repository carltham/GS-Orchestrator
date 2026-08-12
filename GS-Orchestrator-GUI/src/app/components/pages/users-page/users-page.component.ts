import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AppStateService, AppState } from '../../../services/app-state.service';
import { AuthService } from '../../../services/auth.service';

export interface UserItem {
  id: string;
  username: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  enabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-page.component.html',
  styleUrls: ['./users-page.component.css']
})
export class UsersPageComponent implements OnInit {
  activeTab: string = 'users';
  users: UserItem[] = [];
  message: string = '';
  isError: boolean = false;

  showCreateModal: boolean = false;
  showUserModal: boolean = false;
  selectedUser: UserItem | null = null;

  newUsername: string = '';
  newPassword: string = '';
  newRole: 'ADMIN' | 'USER' = 'USER';

  constructor(
    private appState: AppStateService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.appState.state$.subscribe((state: AppState) => {
      this.activeTab = state.activeTab;
      if (this.activeTab === 'users') {
        this.loadUsers();
      }
    });
  }

  loadUsers(): void {
    this.http.get<any>('/orch/admin/users', {
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.users = res.users || [];
        }
      },
      error: (err) => {
        this.showMessage(err.error?.message || 'Failed to load users', true);
      }
    });
  }

  createUser(): void {
    if (!this.newUsername || !this.newPassword) return;

    this.http.post<any>('/orch/admin/users', {
      username: this.newUsername,
      password: this.newPassword,
      role: this.newRole
    }, {
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.showMessage('User created successfully');
          this.showCreateModal = false;
          this.newUsername = '';
          this.newPassword = '';
          this.loadUsers();
        }
      },
      error: (err) => {
        this.showMessage(err.error?.message || 'Failed to create user', true);
      }
    });
  }

  toggleUserStatus(user: UserItem): void {
    const endpoint = user.enabled ? `/orch/admin/users/${user.id}/disable` : `/orch/admin/users/${user.id}/enable`;
    this.http.post<any>(endpoint, {}, {
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showMessage(`User ${user.username} ${user.enabled ? 'disabled' : 'enabled'}`);
        this.loadUsers();
      },
      error: (err) => {
        this.showMessage(err.error?.message || 'Action failed', true);
      }
    });
  }

  deleteUser(user: UserItem): void {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) return;

    this.http.delete<any>(`/orch/admin/users/${user.id}`, {
      headers: this.authService.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showMessage(`User ${user.username} deleted successfully`);
        this.loadUsers();
      },
      error: (err) => {
        this.showMessage(err.error?.message || 'Failed to delete user', true);
      }
    });
  }

  openUserModal(user: UserItem): void {
    this.selectedUser = user;
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.selectedUser = null;
    this.showUserModal = false;
  }

  onToggleStatusFromModal(): void {
    if (!this.selectedUser) return;
    const userToToggle = this.selectedUser;
    this.closeUserModal();
    this.toggleUserStatus(userToToggle);
  }

  onDeleteUserFromModal(): void {
    if (!this.selectedUser) return;
    const userToDelete = this.selectedUser;
    this.closeUserModal();
    this.deleteUser(userToDelete);
  }

  private showMessage(msg: string, isErr = false): void {
    this.message = msg;
    this.isError = isErr;
    setTimeout(() => {
      this.message = '';
    }, 4000);
  }
}
