import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AuthUser {
  id: string;
  username: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
}

export interface LoginRequest {
  username: string;
  password?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AuthUser;
  token?: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private tokenKey = 'gs-orchestrator-token';

  constructor(private http: HttpClient) {
    this.checkAuthStatus();
  }

  login(username: string, password?: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/orch/auth/login', {
      username,
      password
    }).pipe(
      tap(response => {
        if (response.success && response.user && response.token) {
          this.setToken(response.token);
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  logout(): void {
    this.removeToken();
    this.currentUserSubject.next(null);
  }

  checkAuthStatus(): void {
    const token = this.getToken();
    if (!token) {
      this.currentUserSubject.next(null);
      return;
    }

    this.http.get<AuthCheckResponse>('/orch/auth/check', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.authenticated && response.user) {
          this.currentUserSubject.next(response.user);
        } else {
          this.removeToken();
          this.currentUserSubject.next(null);
        }
      },
      error: () => {
        this.removeToken();
        this.currentUserSubject.next(null);
      }
    });
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUserSubject.value;
  }

  isSuperAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'SUPERADMIN';
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || false;
  }

  getCurrentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private removeToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }
}
