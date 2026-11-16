import { HttpClient } from '@angular/common/http';
import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { HubConnection } from '@microsoft/signalr';
import { firstValueFrom } from 'rxjs';
import { AdminSession } from '../../../../core/auth/admin-session';
import { Dashboard } from '../../../dashboard/data/dashboard-models';

export interface ChartsGeneral {
  medianSec: number | null;
  startedLastHour: number;
  finishedLastHour: number;
  bucketMinutes: number;
}
export interface ChartsFamily {
  familyId: number;
  wrong: number;
  timedOut: number;
  /** הרצף הארוך ביותר של תשובות נכונות אצל אחד מבני המשפחה */
  maxStreak: number;
}
export interface ChartsTimelinePoint {
  bucketStart: string;
  started: number;
  finished: number;
  avgSec: number | null;
}
export interface ChartsBin {
  bin: number;
  label: string;
  n: number;
}
export interface ChartsHeatCell {
  familyId: number;
  questionId: number;
  answered: number;
  correct: number;
}
export interface ChartsTopWrong {
  questionId: number;
  topWrong: string;
  topWrongN: number;
  wrongTotal: number;
}
export interface DashboardCharts {
  general: ChartsGeneral;
  families: ChartsFamily[];
  timeline: ChartsTimelinePoint[];
  responseTimes: ChartsBin[];
  heatmap: ChartsHeatCell[];
  topWrong: ChartsTopWrong[];
}
export interface DashboardFull {
  data: Dashboard;
  charts: DashboardCharts;
}

const DEBOUNCE_MS = 1500;
const FALLBACK_POLL_MS = 20000;

/**
 * הדשבורד המתקדם: טעינה אחת של /api/admin/dash, ואחר כך עדכון חי:
 * השרת שולח "changed" ב־SignalR (בלי מטען) ומושכים מחדש אחרי 1.5 שניות שקט.
 * גיבוי: משיכה כל 20 שניות, וגם בחזרה ללשונית.
 */
@Injectable()
export class DashStore {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AdminSession);
  private readonly document = inject(DOCUMENT);

  readonly data = signal<DashboardFull | null>(null);
  readonly failed = signal(false);
  readonly updatedAt = signal<Date | null>(null);
  /** החיבור החי עובד (אחרת רק המשיכה הקבועה) */
  readonly live = signal(false);

  private hub: HubConnection | null = null;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;
  private loading = false;

  constructor() {
    void this.load();
    void this.connect();

    const onVisible = () => {
      if (this.document.visibilityState === 'visible') void this.load();
    };
    const timer = setInterval(onVisible, FALLBACK_POLL_MS);
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearInterval(timer);
      clearTimeout(this.debounce);
      this.document.removeEventListener('visibilitychange', onVisible);
      void this.hub?.stop();
    });
  }

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      this.data.set(await firstValueFrom(this.http.get<DashboardFull>('/api/admin/dash')));
      this.updatedAt.set(new Date());
      this.failed.set(false);
    } catch {
      // נשארים עם הנתונים האחרונים; שגיאה רק אם אין בכלל מה להציג
      this.failed.set(this.data() === null);
    } finally {
      this.loading = false;
    }
  }

  /** "השתנה" מהשרת: מחכים לשקט קצר, ואז מושכים פעם אחת */
  private changed(): void {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.load(), DEBOUNCE_MS);
  }

  private async connect(): Promise<void> {
    try {
      const { HubConnectionBuilder } = await import('@microsoft/signalr');
      if (this.destroyed) return;
      const hub = new HubConnectionBuilder()
        .withUrl('/hubs/dashboard', { accessTokenFactory: () => this.session.token() ?? '' })
        .withAutomaticReconnect()
        .build();
      hub.on('changed', () => this.changed());
      hub.onreconnecting(() => this.live.set(false));
      hub.onreconnected(() => {
        this.live.set(true);
        void this.load();
      });
      hub.onclose(() => this.live.set(false));
      this.hub = hub;
      await hub.start();
      this.live.set(true);
    } catch {
      // בלי חיבור חי: המשיכה כל 20 שניות ממשיכה
      this.live.set(false);
    }
  }
}
