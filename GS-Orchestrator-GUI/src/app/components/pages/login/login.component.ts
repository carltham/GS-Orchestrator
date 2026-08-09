import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  submitted = false;
  errorMessage = '';
  returnUrl = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Redirect to home if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (!this.username) {
      this.errorMessage = 'Username is required';
      return;
    }

    this.loading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.errorMessage = response.message || 'Login failed';
        }
      },
      error: (error) => {
        this.loading = false;
        if (error.status === 401) {
          this.errorMessage = 'Invalid credentials';
        } else if (error.status === 403) {
          this.errorMessage = error.error?.message || 'Access forbidden';
        } else {
          this.errorMessage = 'Login failed. Please try again.';
        }
      }
    });
  }

  loginAsThor(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.loading = true;

    this.authService.login('thor', undefined).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.errorMessage = response.message || 'Login failed';
        }
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Thor login only works from localhost';
      }
    });
  }
}
