import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { EyeLoader } from '../../shared/ui/eye-loader/eye-loader';
import { Icon } from '../../shared/ui/icon/icon';
import { DASHBOARD_SOURCE, DashboardStore, PUBLIC_DASHBOARD } from './data/dashboard-store';
import { DashboardView } from './ui/dashboard-view';

/** התוצאות והסטטיסטיקות לאורחים: נפתח רק אחרי שהמנהל סיים את המשחק ופרסם */
@Component({
  selector: 'app-results-page',
  imports: [DashboardView, EyeLoader, Icon],
  providers: [DashboardStore, { provide: DASHBOARD_SOURCE, useValue: PUBLIC_DASHBOARD }],
  template: `
    <header class="hero">
      <span class="badge rise"><app-icon name="sparkles" /></span>
      <h1 class="rise" style="--d: 0.05s">תוצאות וסטטיסטיקות</h1>
      <p class="rise" style="--d: 0.1s">מי צדק, מי היה הכי מהיר, ואיזו שאלה הפילה את כולם</p>
    </header>

    @if (store.data(); as d) {
      <app-dashboard-view class="rise" style="--d: 0.15s" [data]="d" [myFamilyId]="myFamilyId" />
    } @else if (store.notPublished()) {
      <section class="panel lg rise">
        <p>התוצאות המלאות יפורסמו כאן בסוף המשחק.</p>
        <p class="sub">בינתיים, לוח התוצאות מתעדכן חי.</p>
      </section>
    } @else if (store.failed()) {
      <section class="panel lg">
        <p>אין חיבור כרגע.</p>
        <button type="button" class="b lg gs press" (click)="store.reload()">נסו שוב</button>
      </section>
    } @else {
      <div class="note"><app-eye-loader [size]="72" label="טוען את התוצאות" /></div>
    }
  `,
  styles: `
    :host { display: grid; gap: 16px; padding-bottom: 24px; }
    .hero { display: grid; justify-items: center; gap: 6px; text-align: center; padding-top: 8px; }
    .badge { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(217, 182, 111, 0.2); color: var(--color-gold); }
    h1 { margin: 0; font: 700 30px var(--font-display); color: var(--color-gold); }
    .hero p { margin: 0; color: rgba(248, 243, 234, 0.75); }
    .panel { display: grid; gap: 10px; justify-items: center; padding: 22px; text-align: center; &::after { content: none; } p { margin: 0; } }
    .sub { font-size: 14px; color: rgba(248, 243, 234, 0.65); }
    .note { display: grid; place-items: center; padding: 40px 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ResultsPage {
  protected readonly store = inject(DashboardStore);
  protected readonly myFamilyId = inject(AuthStore).guest()?.familyId ?? null;
}
