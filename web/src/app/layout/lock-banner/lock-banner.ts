import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdminSession } from '../../core/auth/admin-session';
import { LockStore } from '../../core/save-the-date/lock-store';

/** למנהל בלבד, בראש כל מסך, כשמצב Save the date פעיל. לא במצגת ולא במסך הנעילה עצמו. */
@Component({
  selector: 'app-lock-banner',
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <a class="bar" role="status" routerLink="/admin/save-the-date">
        <span class="dot" aria-hidden="true"></span>
        מצב Save the date פעיל (רק מנהלים נכנסים)
      </a>
    }
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: calc(6px + env(safe-area-inset-top)) 16px 6px;
      background: linear-gradient(90deg, #9a7634, #be9550);
      color: #1e2235;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #1e2235; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LockBanner {
  private readonly lock = inject(LockStore);
  private readonly admin = inject(AdminSession);
  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: '' },
  );

  protected readonly visible = computed(() => {
    const url = this.url();
    const hidden = url.startsWith('/show') || url.startsWith('/save-the-date') || url.includes('/preview');
    return this.lock.locked() && this.admin.isLoggedIn() && !hidden;
  });
}
