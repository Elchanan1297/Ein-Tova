import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { Icon } from '../../shared/ui/icon/icon';
import { DashV2 } from './charts/dash-v2';
import { CHARTS_SOURCE, PUBLIC_CHARTS } from './charts/dash-store';

/**
 * התוצאות והסטטיסטיקות לאורחים, עם הגרפים: נפתח רק אחרי שהמנהל סיים את המשחק ופרסם
 * (עד אז /api/results/full מחזיר 404 והמסך אומר שהתוצאות יפורסמו בסוף).
 */
@Component({
  selector: 'app-results-page',
  imports: [DashV2, Icon],
  providers: [{ provide: CHARTS_SOURCE, useValue: PUBLIC_CHARTS }],
  template: `
    <header class="hero">
      <span class="badge rise"><app-icon name="sparkles" /></span>
      <h1 class="rise" style="--d: 0.05s">תוצאות וסטטיסטיקות</h1>
      <p class="rise" style="--d: 0.1s">מי צדק, מי היה הכי מהיר, ואיזו שאלה הפילה את כולם</p>
    </header>

    <app-dash-v2 class="rise" style="--d: 0.15s" [myFamilyId]="myFamilyId" />
  `,
  styles: `
    :host { display: grid; gap: 16px; padding-bottom: 24px; }
    .hero { display: grid; justify-items: center; gap: 6px; text-align: center; padding-top: 8px; }
    .badge { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(217, 182, 111, 0.2); color: var(--color-gold); }
    h1 { margin: 0; font: 700 30px var(--font-display); color: var(--color-gold); }
    .hero p { margin: 0; color: rgba(248, 243, 234, 0.75); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ResultsPage {
  protected readonly myFamilyId = inject(AuthStore).guest()?.familyId ?? null;
}
