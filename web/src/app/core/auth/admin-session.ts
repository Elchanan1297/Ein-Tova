import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const STORAGE_KEY = 'eintova.admin';

/** כניסת מנהל: טוקן נפרד מזה של המוזמן, נשלח רק לבקשות /api/admin. */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly http = inject(HttpClient);
  readonly token = signal<string | null>(read());
  readonly isLoggedIn = computed(() => this.token() !== null);

  async login(password: string): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ token: string }>('/api/admin/login', { password }));
    this.save(res.token);
  }

  logout(): void {
    this.save(null);
  }

  private save(token: string | null): void {
    this.token.set(token);
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // בלי אחסון: מחובר רק בלשונית הנוכחית
    }
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
