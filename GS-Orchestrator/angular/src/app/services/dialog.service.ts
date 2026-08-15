import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface DialogOptions {
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  confirmText?: string;
  cancelText?: string;
}

export interface DialogRequest extends DialogOptions {
  resolve: (result: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogSubject = new Subject<DialogRequest | null>();
  public dialog$: Observable<DialogRequest | null> = this.dialogSubject.asObservable();

  alert(message: string, title = 'Notification'): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'alert',
        confirmText: 'OK',
        resolve: (result) => {
          this.dialogSubject.next(null);
          resolve(result);
        }
      });
    });
  }

  confirm(message: string, title = 'Confirm Action'): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'confirm',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        resolve: (result) => {
          this.dialogSubject.next(null);
          resolve(result);
        }
      });
    });
  }
}
