import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';
import { Dashboard } from './dashboard-models';

/** מאיפה מגיעים הנתונים: מנהל (תמיד) או אורחים (רק אחרי סיום המשחק), וכל כמה זמן מרעננים */
export interface DashboardSource {
  url: string;
  refreshMs: number;
}

export const DASHBOARD_SOURCE = new InjectionToken<DashboardSource>('DASHBOARD_SOURCE');

export const ADMIN_DASHBOARD: DashboardSource = { url: '/api/admin/dashboard', refreshMs: 3000 };
export const PUBLIC_DASHBOARD: DashboardSource = { url: '/api/results', refreshMs: 10000 };

/**
 * הדשבורד בזמן אמת: רענון קבוע רק כשהמסך גלוי. מסופק ברמת הדף (נעצר כשיוצאים).
 * בזמן תקלה רגעית נשארים עם הנתונים האחרונים.
 */
@Injectable()
export class DashboardStore {
  private readonly document = inject(DOCUMENT);
  private readonly source = inject(DASHBOARD_SOURCE);
  private readonly resource = httpResource<Dashboard>(() => this.source.url);
  private readonly last = signal<Dashboard | null>(null);

  readonly data = this.last.asReadonly();
  /** מתי הגיעו הנתונים האחרונים (לחיווי "חי") */
  readonly updatedAt = signal<Date | null>(null);
  /** האורחים: 404 = עוד לא פורסם */
  readonly notPublished = computed(() => {
    const e = this.resource.error();
    return e instanceof HttpErrorResponse && e.status === 404;
  });
  readonly failed = computed(() => this.resource.error() !== undefined && !this.notPublished() && this.last() === null);

  constructor() {
    effect(() => {
      if (!this.resource.hasValue()) {
        // פרסום בוטל בזמן שהמסך פתוח: לא להמשיך להציג נתונים ישנים
        if (this.notPublished()) this.last.set(null);
        return;
      }
      this.last.set(this.resource.value());
      this.updatedAt.set(new Date());
    });

    const refresh = () => {
      if (this.document.visibilityState === 'visible') this.resource.reload();
    };
    const timer = setInterval(refresh, this.source.refreshMs);
    this.document.addEventListener('visibilitychange', refresh);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', refresh);
    });
  }

  reload(): void {
    this.resource.reload();
  }
}
