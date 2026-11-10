import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth-store';
import { EyeLoader } from '../../shared/ui/eye-loader/eye-loader';

/** כניסה: קוד מהקישור האישי (?code=...), ואם אין, מספר טלפון. */
@Component({
  selector: 'app-login-page',
  imports: [EyeLoader],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LoginPage implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** מגיע מ־query param דרך withComponentInputBinding */
  readonly code = input<string>();

  protected readonly phone = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const code = this.code();
    if (code) void this.run(() => this.auth.loginByCode(code), 'הקישור לא תקין. אפשר להיכנס עם מספר טלפון.');
  }

  protected submitPhone(event: Event): void {
    event.preventDefault();
    const phone = this.phone().trim();
    if (phone) void this.run(() => this.auth.loginByPhone(phone), 'המספר לא נמצא ברשימת המוזמנים.');
  }

  private async run(login: () => Promise<unknown>, failMessage: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await login();
      // אחרי כניסה תמיד דרך מסך הפתיחה (שם גם משתחררת חסימת האודיו)
      await this.router.navigateByUrl('/');
    } catch {
      this.error.set(failMessage);
    } finally {
      this.busy.set(false);
    }
  }
}
