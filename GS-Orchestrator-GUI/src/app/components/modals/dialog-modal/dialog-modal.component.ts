import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DialogRequest } from '../../../services/dialog.service';

@Component({
  selector: 'app-dialog-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="request" class="modal-backdrop" (click)="onCancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>{{ request.title }}</h3>
        <p class="dialog-message">{{ request.message }}</p>

        <div class="modal-actions">
          <button
            *ngIf="request.type === 'confirm'"
            type="button"
            class="btn-secondary"
            (click)="onCancel()"
          >
            {{ request.cancelText || 'Cancel' }}
          </button>
          <button
            type="button"
            class="btn-primary"
            (click)="onConfirm()"
          >
            {{ request.confirmText || 'OK' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-content {
      background: #1e1e1e;
      color: #f0f0f0;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 24px;
      min-width: 320px;
      max-width: 480px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    .modal-content h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 1.25rem;
      color: #fff;
    }

    .dialog-message {
      margin-bottom: 24px;
      font-size: 0.95rem;
      line-height: 1.4;
      color: #ccc;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn-primary {
      background-color: #007acc;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-primary:hover {
      background-color: #005999;
    }

    .btn-secondary {
      background-color: #3c3c3c;
      color: #ccc;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-secondary:hover {
      background-color: #505050;
    }
  `]
})
export class DialogModalComponent implements OnInit {
  request: DialogRequest | null = null;

  constructor(private dialogService: DialogService) {}

  ngOnInit(): void {
    this.dialogService.dialog$.subscribe((req) => {
      this.request = req;
    });
  }

  onConfirm(): void {
    if (this.request) {
      this.request.resolve(true);
    }
  }

  onCancel(): void {
    if (this.request) {
      this.request.resolve(false);
    }
  }
}
