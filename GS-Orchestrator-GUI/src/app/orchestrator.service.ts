import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './services/auth.service';

export interface ProjectEntry {
  name: string;
  path: string;
  registeredAt: string;
  components: Record<string, number>;
  status: string;
  ticket?: string;
}

export interface UnregisteredServer {
  port: number;
  pid?: number;
  projectName?: string;
  projectPath?: string;
  cmd?: string;
  type?: string;
  detectedAt?: string;
}

export interface UnregisteredServersData {
  lastScanned: string;
  servers: UnregisteredServer[];
}

export interface RegistryData {
  projects: Record<string, ProjectEntry>;
  nextPortBase: number;
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrchestratorService {
  private baseUrl = 'http://localhost:9000';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }

  getApiHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/health`);
  }

  getRegistry(): Observable<RegistryData> {
    return this.http.get<RegistryData>(`${this.baseUrl}/api/registry`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getProjectCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/api/count`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getUnregisteredServers(): Observable<UnregisteredServersData> {
    return this.http.get<UnregisteredServersData>(`${this.baseUrl}/api/unregistered`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  registerProject(data: {
    projectName: string;
    path: string;
    serviceTypes?: Record<string, string>;
    basePorts?: Record<string, number>;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/register`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  sendHealthReport(data: {
    projectName: string;
    health: { status: string; uptimeSeconds: number };
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/health`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  unregisterProject(projectName: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/register/${projectName}`, {
      headers: this.authService.getAuthHeaders()
    });
  }
}
