import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectEntry } from '../../../orchestrator.service';

@Component({
  selector: 'app-state-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './state-modal.component.html',
  styleUrls: ['./state-modal.component.css']
})
export class StateModalComponent {
  @Input() isOpen = false;
  @Input() project: ProjectEntry | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() stopProjectClicked = new EventEmitter<void>();
  @Output() restartProjectClicked = new EventEmitter<void>();
  @Output() removeProjectClicked = new EventEmitter<void>();

  closeModal(): void {
    this.closed.emit();
  }

  stopProject(): void {
    this.stopProjectClicked.emit();
  }

  restartProject(): void {
    this.restartProjectClicked.emit();
  }

  removeProject(): void {
    this.removeProjectClicked.emit();
  }
}
