import * as fs from 'fs';
import * as path from 'path';
import { User, AuthUser } from '../domain/User';

export class UserService {
  private usersPath: string;
  private users: Map<string, User> = new Map();

  constructor(usersPath: string) {
    this.usersPath = usersPath;
    this.loadUsers();
  }

  private loadUsers(): void {
    if (fs.existsSync(this.usersPath)) {
      try {
        const data = fs.readFileSync(this.usersPath, 'utf-8');
        const usersArray: User[] = JSON.parse(data);
        usersArray.forEach(user => {
          this.users.set(user.id, user);
        });
      } catch (err) {
        console.error('Error loading users:', err);
        this.initializeDefaultUsers();
      }
    } else {
      this.initializeDefaultUsers();
    }
  }

  private initializeDefaultUsers(): void {
    // Create default superadmin user (no password, localhost only)
    const superadmin: User = {
      id: 'thor-superadmin',
      username: 'thor',
      role: 'SUPERADMIN',
      enabled: true,
      createdAt: new Date()
    };

    this.users.set(superadmin.id, superadmin);
    this.saveUsers();
  }

  private saveUsers(): void {
    const usersArray = Array.from(this.users.values());
    const usersDir = path.dirname(this.usersPath);
    if (!fs.existsSync(usersDir)) {
      fs.mkdirSync(usersDir, { recursive: true });
    }
    fs.writeFileSync(this.usersPath, JSON.stringify(usersArray, null, 2), 'utf-8');
  }

  authenticate(username: string, password: string | undefined, isLocalhost: boolean): AuthUser | null {
    // Special case: Thor superadmin login (localhost only, no password required)
    if (username === 'thor' && isLocalhost && !password) {
      const user = this.users.get('thor-superadmin');
      if (user && user.enabled) {
        user.lastLoginAt = new Date();
        this.saveUsers();
        return {
          id: user.id,
          username: user.username,
          role: user.role
        };
      }
    }

    // Regular user authentication (requires password)
    for (const user of this.users.values()) {
      if (user.username === username && user.enabled && user.password === password) {
        user.lastLoginAt = new Date();
        this.saveUsers();
        return {
          id: user.id,
          username: user.username,
          role: user.role
        };
      }
    }

    return null;
  }

  getUserById(id: string): AuthUser | null {
    const user = this.users.get(id);
    if (user) {
      return {
        id: user.id,
        username: user.username,
        role: user.role
      };
    }
    return null;
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  createUser(username: string, password: string, role: 'ADMIN' | 'USER' = 'USER'): User | null {
    // Check if username already exists
    for (const user of this.users.values()) {
      if (user.username === username) {
        return null; // User already exists
      }
    }

    const id = `user-${Date.now()}`;
    const newUser: User = {
      id,
      username,
      password,
      role,
      enabled: true,
      createdAt: new Date()
    };

    this.users.set(id, newUser);
    this.saveUsers();
    return newUser;
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    const user = this.users.get(id);
    if (!user) return null;

    Object.assign(user, updates, { id: user.id }); // Prevent id change
    this.saveUsers();
    return user;
  }

  deleteUser(id: string): boolean {
    if (id === 'thor-superadmin') {
      return false; // Cannot delete superadmin
    }
    const deleted = this.users.delete(id);
    if (deleted) {
      this.saveUsers();
    }
    return deleted;
  }

  disableUser(id: string): boolean {
    if (id === 'thor-superadmin') {
      return false; // Cannot disable superadmin
    }
    const user = this.users.get(id);
    if (user) {
      user.enabled = false;
      this.saveUsers();
      return true;
    }
    return false;
  }

  enableUser(id: string): boolean {
    const user = this.users.get(id);
    if (user) {
      user.enabled = true;
      this.saveUsers();
      return true;
    }
    return false;
  }

  changePassword(id: string, newPassword: string): boolean {
    if (id === 'thor-superadmin') {
      return false; // Cannot change superadmin password
    }
    const user = this.users.get(id);
    if (user) {
      user.password = newPassword;
      this.saveUsers();
      return true;
    }
    return false;
  }
}
