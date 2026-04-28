import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly STORAGE_KEY = 'ms_analyzer_user_name';
  readonly userName = signal<string | null>(this.getStoredName());
  readonly showModal = signal<boolean>(false);

  private modalResolver: ((name: string | null) => void) | null = null;

  constructor() {}

  private getStoredName(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  setUserName(name: string | null): void {
    if (name) {
      const trimmed = name.trim();
      if (trimmed) {
        localStorage.setItem(this.STORAGE_KEY, trimmed);
        this.userName.set(trimmed);
        if (this.modalResolver) {
          this.modalResolver(trimmed);
          this.modalResolver = null;
        }
      }
    } else {
      if (this.modalResolver) {
        this.modalResolver(null);
        this.modalResolver = null;
      }
    }
    this.showModal.set(false);
  }

  getUserName(): string | null {
    return this.userName();
  }

  /**
   * Triggers the name selection modal.
   */
  promptName(): Promise<string | null> {
    this.showModal.set(true);
    return new Promise((resolve) => {
      this.modalResolver = resolve;
    });
  }

  /**
   * Returns the current user name or prompts the user if none is set.
   */
  async ensureUserName(): Promise<string | null> {
    const name = this.getUserName();
    if (name) return name;
    return this.promptName();
  }
}
