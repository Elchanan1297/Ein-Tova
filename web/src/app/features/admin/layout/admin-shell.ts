import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminSession } from '../../../core/auth/admin-session';

/** מעטפת הניהול: פס עליון עם ניווט ויציאה. עובד בטלפון ובמחשב. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="bar lg">
      <a class="brand" routerLink="/admin">
        <img src="assets/logo/ein-tova-eye-symbol-dark.svg" alt="" width="34" height="31" />
        <span>ניהול</span>
      </a>
      <nav aria-label="ניהול">
        <a routerLink="settings" routerLinkActive="active">הגדרות ומשחק</a>
        <a routerLink="questions" routerLinkActive="active">שאלות</a>
        <a routerLink="guests" routerLinkActive="active">מוזמנים</a>
        <a routerLink="content" routerLinkActive="active">תוכן</a>
        <a routerLink="photos" routerLinkActive="active">מסע בזמן</a>
        <a routerLink="show" routerLinkActive="active">מצגת</a>
      </nav>
      <button type="button" class="b press out" (click)="logout()">יציאה</button>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; background: var(--bg-app); }
    .bar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 10px max(16px, calc((100% - 960px) / 2));
      border-radius: 0;
      border-inline: 0;
      border-top: 0;
      &::after { content: none; }
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-gold);
      font: 700 20px var(--font-display);
      text-decoration: none;
    }
    nav {
      display: flex;
      gap: 6px;
      flex: 1;
      overflow-x: auto;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }
    nav a {
      padding: 8px 14px;
      border-radius: var(--radius-pill);
      color: rgba(248, 243, 234, 0.8);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      &.active { background: rgba(217, 182, 111, 0.22); color: var(--color-gold); }
    }
    .out { padding: 8px 12px; color: rgba(248, 243, 234, 0.7); font-weight: 600; }
    main { max-width: 960px; margin-inline: auto; padding: 20px 16px 60px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminShell {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  protected logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/admin/login');
  }
}
