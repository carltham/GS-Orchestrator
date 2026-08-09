import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    if (this.authService.isAuthenticated()) {
      // Check for admin requirement
      if (route.data['role'] === 'admin' && !this.authService.isAdmin()) {
        this.router.navigate(['/']);
        return false;
      }

      if (route.data['role'] === 'superadmin' && !this.authService.isSuperAdmin()) {
        this.router.navigate(['/']);
        return false;
      }

      return true;
    }

    // Not authenticated, redirect to login
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
