import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { AdminSession } from '../auth/admin-session';
import { SaveTheDateInfo, SaveTheDateState } from './save-the-date-models';

const STORAGE_KEY = 'eintova.saveTheDate';
export const SAVE_THE_DATE_PATH = '/save-the-date';

/**
 * מצב "Save the date": האם האפליקציה נעולה לכולם חוץ מהמנהל.
 * מקורות: /api/config בעלייה (בלי מטמון), SignalR (/hubs/state, LockChanged), בדיקה כל 60 שניות
 * ובכל חזרה לאפליקציה, ו־423 מכל קריאת API.
 * המצב האחרון נשמר מקומית רק כדי להמשיך להציג נעילה בלי רשת. פתיחה דורשת תשובה מהשרת.
 */
@Injectable({ providedIn: 'root' })
export class LockStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly admin = inject(AdminSession);
  private readonly document = inject(DOCUMENT);

  /** ההגדרות להצגה כשנעול; null כשפתוח */
  readonly info = signal<SaveTheDateInfo | null>(readStored());
  readonly locked = computed(() => this.info() !== null);
  /** מוזמן (לא מנהל) בזמן נעילה: רואה רק את המסך */
  readonly lockedOut = computed(() => this.locked() && !this.admin.isLoggedIn());
  /** הפרש בין שעון השרת למכשיר, לספירה לאחור מדויקת גם כשהשעון בטלפון לא נכון */
  readonly clockOffset = signal(0);

  private watching = false;

  constructor() {
    // כשהמצב משתנה תוך כדי שימוש: מעבר למסך הנעילה, או חזרה לאפליקציה
    effect(() => {
      const out = this.lockedOut();
      untracked(() => this.route(out));
    });
  }

  /** בעליית האפליקציה: לא מחכים יותר מ־4 שניות (בלי רשת נשארים עם המצב האחרון) */
  async init(): Promise<void> {
    await this.refresh(4000);
    this.watch();
  }

  async refresh(waitMs = 10000): Promise<void> {
    try {
      const cfg = await firstValueFrom(
        this.http
          .get<{ saveTheDate?: SaveTheDateState }>('/api/config', {
            // לא דרך המטמון של ה־Service Worker ולא של הדפדפן
            headers: { 'ngsw-bypass': '1', 'Cache-Control': 'no-cache' },
          })
          .pipe(timeout(waitMs)),
      );
      this.apply(cfg.saveTheDate ?? { locked: false });
    } catch {
      // אין תשובה: נשארים במצב האחרון הידוע
    }
  }

  private apply(s: SaveTheDateState): void {
    if (s.locked) {
      this.clockOffset.set(Date.parse(s.serverNow) - Date.now() || 0);
      this.info.set(s);
    } else {
      this.info.set(null);
    }
    store(s.locked ? s : null);
  }

  private route(lockedOut: boolean): void {
    if (!this.router.navigated) return; // הניווט הראשון עובר דרך ה־guard
    const url = this.router.url;
    const onScreen = url.startsWith(SAVE_THE_DATE_PATH);
    if (lockedOut && !onScreen && !url.startsWith('/admin')) {
      void this.router.navigateByUrl(SAVE_THE_DATE_PATH, { replaceUrl: true });
    } else if (!lockedOut && onScreen) {
      void this.router.navigateByUrl('/', { replaceUrl: true });
    }
  }

  private watch(): void {
    if (this.watching) return;
    this.watching = true;

    setInterval(() => void this.refresh(), 60000);
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') void this.refresh();
    });
    void this.connectHub();
  }

  /** SignalR נטען בנפרד, אחרי שהאפליקציה עלתה (לא מכביד על הטעינה הראשונה) */
  private async connectHub(): Promise<void> {
    const { HubConnectionBuilder } = await import('@microsoft/signalr');
    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/state')
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 5000 + Math.random() * 5000 })
      .build();
    hub.on('LockChanged', (locked: boolean) => {
      if (locked !== this.locked()) void this.refresh();
    });
    // אחרי ניתוק ארוך: מתחברים שוב, ובינתיים ה־polling מכסה
    hub.onclose(() => setTimeout(start, 15000));
    const start = () => hub.start().catch(() => setTimeout(start, 15000));
    start();
  }
}

function readStored(): SaveTheDateInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SaveTheDateInfo) : null;
  } catch {
    return null;
  }
}

function store(info: SaveTheDateInfo | null): void {
  try {
    if (info) localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // בלי אחסון: המצב רק בזיכרון
  }
}
