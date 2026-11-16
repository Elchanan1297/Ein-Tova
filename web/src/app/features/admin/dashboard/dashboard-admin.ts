import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';
import { ADMIN_DASHBOARD, DASHBOARD_SOURCE, DashboardStore } from '../../dashboard/data/dashboard-store';
import { DashboardView } from '../../dashboard/ui/dashboard-view';
import { DashV2 } from './v2/dash-v2';

const V2_KEY = 'eintova.dashV2';

/**
 * דשבורד בזמן אמת למנהל (רענון כל 3 שניות), וסיום המשחק:
 * "סיום המשחק ופרסום" סוגר את המשחק לכולם ופותח את הדשבורדים לאורחים ולמסך הגדול.
 */
@Component({
  selector: 'app-dashboard-admin',
  imports: [DashboardView, DashV2, EyeLoader],
  providers: [DashboardStore, { provide: DASHBOARD_SOURCE, useValue: ADMIN_DASHBOARD }],
  template: `
    <header class="head">
      <div>
        <h1>דשבורד</h1>
        <p class="live-line">
          <span class="live" aria-hidden="true"></span>
          מתעדכן חי
          @if (updated(); as t) { · עודכן ב־{{ t }} }
        </p>
      </div>
      <!-- מתג: הדשבורד המתקדם (גרפים) או הרגיל. נשמר בדפדפן הזה -->
      <label class="flag">
        <input type="checkbox" role="switch" [checked]="v2()" (change)="setV2($any($event.target).checked)" />
        <span>דשבורד גרפים (חדש)</span>
      </label>
    </header>

    @if (store.data(); as d) {
      <section class="end lg" [class.published]="d.summary.published">
        @if (d.summary.published) {
          <div>
            <b>המשחק הסתיים והתוצאות פורסמו</b>
            <p>האורחים רואים את הדשבורד באפליקציה, ואפשר להציג אותו במסך הגדול (מצגת → סטטיסטיקות).</p>
          </div>
          <button type="button" class="b press" [disabled]="busy()" (click)="setPublished(false)">ביטול הפרסום</button>
        } @else {
          <div>
            <b>{{ d.summary.isOpen ? 'המשחק פתוח' : 'המשחק סגור' }}</b>
            <p>הדשבורד גלוי כרגע רק כאן. בסיום: המשחק ייסגר לכולם, והדשבורדים יוצגו באפליקציה ובמסך הגדול.</p>
          </div>
          <button type="button" class="b lg gs press" [disabled]="busy()" (click)="endDialog.showModal()">
            סיום המשחק ופרסום
          </button>
        }
      </section>
      @if (error()) {
        <p class="msg" role="alert">{{ error() }}</p>
      }

      @if (v2()) {
        <app-dash-v2 />
      } @else {
        <app-dashboard-view [data]="d" [admin]="true" />
      }
    } @else if (store.failed()) {
      <p class="note">לא הצלחנו לטעון. <button type="button" class="b link" (click)="store.reload()">נסו שוב</button></p>
    } @else {
      <div class="note"><app-eye-loader [size]="56" /></div>
    }

    <dialog #endDialog class="lg" aria-labelledby="end-title" (cancel)="close()">
      <h2 id="end-title">לסיים את המשחק?</h2>
      <p>
        המשחק ייסגר לכולם, כולל מי שבאמצע (שאלות שלא נענו לא ייספרו).
        הדשבורדים יוצגו לכל האורחים באפליקציה ובמסך הגדול. אפשר לבטל את הפרסום אחר כך.
      </p>
      @if (playing(); as n) {
        <p class="warn">שימו לב: {{ n }} {{ n === 1 ? 'משחק' : 'משחקים' }} עכשיו.</p>
      }
      <div class="actions">
        <button type="button" class="b press" (click)="close()">ביטול</button>
        <button type="button" class="b lg gs press" [disabled]="busy()" (click)="endGame()">לסיים ולפרסם</button>
      </div>
    </dialog>
  `,
  styles: `
    :host { display: grid; gap: 14px; }
    .head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
    .flag { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 99px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); font-size: 13px; font-weight: 600; cursor: pointer; }
    .flag input { width: 18px; height: 18px; accent-color: var(--color-gold); }
    .head h1 { margin: 0; font: 700 28px var(--font-display); color: var(--color-gold); }
    .live-line { margin: 2px 0 0; display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(248, 243, 234, 0.65); }
    .live { width: 9px; height: 9px; border-radius: 50%; background: #6fd98b; animation: pulse 1.6s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(111, 217, 139, 0.6); } 100% { box-shadow: 0 0 0 9px rgba(111, 217, 139, 0); } }
    .end {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      &::after { content: none; }
      b { font-size: 17px; }
      button { padding: 10px 18px; white-space: nowrap; }
      p { margin: 4px 0 0; font-size: 14px; color: rgba(248, 243, 234, 0.7); }
      &.published { border-color: rgba(111, 217, 139, 0.5); b { color: #8fe3a6; } }
    }
    .msg { margin: 0; color: #ffb4a8; }
    .note { display: grid; place-items: center; padding: 40px 0; }
    dialog {
      width: min(calc(100% - 32px), 460px);
      padding: 22px;
      border: 1px solid var(--glass-border);
      border-radius: 22px;
      background: #262b45;
      color: var(--color-cream);
      &::backdrop { background: rgba(10, 12, 24, 0.6); }
      &::after { content: none; }
      h2 { margin: 0 0 8px; font: 700 22px var(--font-display); }
      p { margin: 0 0 8px; line-height: 1.5; color: rgba(248, 243, 234, 0.8); }
      .warn { color: var(--color-gold); font-weight: 600; }
    }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; button { padding: 10px 18px; } }
    @media (prefers-reduced-motion: reduce) { .live { animation: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DashboardAdmin {
  protected readonly store = inject(DashboardStore);
  private readonly http = inject(HttpClient);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>("endDialog");
  protected readonly busy = signal(false);
  /** הדשבורד המתקדם (גרפים): נבחר כאן, נשמר בדפדפן */
  protected readonly v2 = signal(readV2());
  protected readonly error = signal<string | null>(null);

  protected readonly updated = computed(() =>
    this.store.updatedAt()?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? null,
  );
  protected readonly playing = computed(() => this.store.data()?.players.filter((p) => p.status === 'playing').length ?? 0);

  protected setV2(on: boolean): void {
    this.v2.set(on);
    try {
      localStorage.setItem(V2_KEY, on ? '1' : '0');
    } catch {
      // בלי אחסון: נשאר רק עד הרענון
    }
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected async endGame(): Promise<void> {
    await this.setPublished(true);
    this.close();
  }

  protected async setPublished(publish: boolean): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.http.post('/api/admin/game/results', { publish }));
      this.store.reload();
    } catch {
      this.error.set('הפעולה נכשלה. נסו שוב.');
    } finally {
      this.busy.set(false);
    }
  }
}

function readV2(): boolean {
  try {
    return localStorage.getItem(V2_KEY) === '1';
  } catch {
    return false;
  }
}
