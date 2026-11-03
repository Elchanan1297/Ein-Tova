import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Guest, LoginResponse } from './auth-models';

const STORAGE_KEY = 'eintova.session';

/** מצב ההתחברות של האורח: טוקן + פרטי אורח, נשמר ב־localStorage. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly session = signal<LoginResponse | null>(readSession());

  readonly token = computed(() => this.session()?.token ?? null);
  readonly guest = computed<Guest | null>(() => this.session()?.guest ?? null);
  readonly isLoggedIn = computed(() => this.token() !== null);

  loginByCode(code: string): Promise<Guest> {
    return this.login('/api/login/code', { code });
  }

  loginByPhone(phone: string): Promise<Guest> {
    return this.login('/api/login/phone', { phone });
  }

  logout(): void {
    this.save(null);
  }

  private async login(url: string, body: object): Promise<Guest> {
    const res = await firstValueFrom(this.http.post<LoginResponse>(url, body));
    this.save(res);
    return res.guest;
  }

  private save(value: LoginResponse | null): void {
    this.session.set(value);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // מצב גלישה פרטית: נשארים מחוברים רק בלשונית הנוכחית
    }
  }
}

function readSession(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse) : null;
  } catch {
    return null;
  }
}
