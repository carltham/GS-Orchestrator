export interface User {
  id: string;
  username: string;
  password?: string;
  email?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  enabled: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

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
}
