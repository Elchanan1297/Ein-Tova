import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminSession } from '../../../core/auth/admin-session';

/** כניסה לניהול בסיסמה. */
@Component({
  selector: 'app-admin-login-page',
  template: `
    <form class="card lg rise" (submit)="submit($event)">
      <img src="assets/logo/ein-tova-eye-symbol-dark.svg" alt="" width="72" height="66" />
      <h1>ניהול</h1>
      <label for="pw">סיסמה</label>
      <input
        id="pw"
        type="password"
        autocomplete="current-password"
        dir="ltr"
        [value]="password()"
        (input)="password.set($any($event.target).value)"
      />
      <button class="b lg gs press" type="submit" [disabled]="busy() || !password()">
        {{ busy() ? 'נכנס…' : 'כניסה' }}
      </button>
      @if (error(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }
    </form>
  `,
  styles: `
    :host { display: grid; place-items: center; min-height: 100dvh; padding: 20px; background: var(--bg-app); }
    .card { display: grid; gap: 12px; justify-items: center; width: min(100%, 360px); padding: 28px 24px; border-radius: var(--radius-card); }
    h1 { font-size: 26px; }
    label { justify-self: start; font-weight: 600; }
    input {
      width: 100%;
      padding: 13px 16px;
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--color-cream);
      font: inherit;
      font-size: 17px;
      &:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
    }
    button { width: 100%; padding: 13px; border-radius: var(--radius-pill); font-size: 17px; font-weight: 700; text-align: center; }
    button:disabled { opacity: 0.6; }
    .error { margin: 0; color: #f3a6a6; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminLoginPage {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.session.login(this.password());
      await this.router.navigateByUrl('/admin');
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      this.error.set(
        status === 401 ? 'סיסמה שגויה.' : status === 429 ? 'יותר מדי ניסיונות. נסו שוב בעוד דקה.' : 'אין חיבור לשרת.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
