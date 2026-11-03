import { httpResource } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, computed, inject } from '@angular/core';
import { Leaderboard } from './data/leaderboard-models';

const REFRESH_MS = 7000;

/**
 * לוח תוצאות חי: רענון כל 7 שניות, רק כשהמסך גלוי (חוסך סוללה ועומס).
 * מסופק ברמת הדף, כך שהרענון נעצר כשיוצאים מהמסך.
 */
@Injectable()
export class LeaderboardStore {
  private readonly document = inject(DOCUMENT);
  private readonly resource = httpResource<Leaderboard>(() => '/api/leaderboard');

  readonly data = computed(() => this.resource.value() ?? null);
  readonly families = computed(() => this.data()?.families ?? []);
  readonly top = computed(() => this.data()?.top ?? []);
  readonly finishedCount = computed(() => this.families().reduce((sum, f) => sum + f.finished, 0));
  readonly byAverage = computed(() => this.families()[0]?.rankBy === 'Average');
  /** שגיאה רק אם אין בכלל נתונים להציג; בזמן תקלה רגעית נשארים עם הנתונים האחרונים */
  readonly failed = computed(() => this.resource.error() !== undefined && this.data() === null);

  constructor() {
    const refresh = () => {
      if (this.document.visibilityState === 'visible') this.resource.reload();
    };
    const timer = setInterval(refresh, REFRESH_MS);
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
