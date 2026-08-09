import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.css']
})
export class LoginModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() loginSuccess = new EventEmitter<void>();

  username = '';
  password = '';
  loading = false;
  errorMessage = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {}

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.username) {
      this.errorMessage = 'Username is required';
      return;
    }

    this.loading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.resetForm();
          this.loginSuccess.emit();
        } else {
          this.errorMessage = response.message || 'Login failed';
        }
      },
      error: (error: any) => {
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
    this.errorMessage = '';
    this.loading = true;

    this.authService.login('thor', undefined).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.resetForm();
          this.loginSuccess.emit();
        } else {
          this.errorMessage = response.message || 'Login failed';
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Thor login only works from localhost';
      }
    });
  }

  private resetForm(): void {
    this.username = '';
    this.password = '';
    this.errorMessage = '';
  }
}
