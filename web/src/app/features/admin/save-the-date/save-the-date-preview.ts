import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaveTheDateScreen, SaveTheDateView } from '../../save-the-date/ui/save-the-date-screen';
import { SaveTheDateApi } from '../data/save-the-date-api';

/**
 * /admin/save-the-date/preview: אותו רכיב שהמוזמנים רואים, עם מה שבטופס (גם לפני שמירה).
 * בטלפון במסך מלא; במסך רחב במסגרת בגודל טלפון. לא משנה כלום בשרת.
 */
@Component({
  selector: 'app-save-the-date-preview',
  imports: [SaveTheDateScreen, RouterLink],
  template: `
    <a class="back b lg press" routerLink="/admin/save-the-date">חזרה לעריכה</a>
    @if (view(); as v) {
      <div class="frame">
        <app-save-the-date-screen [info]="v" />
      </div>
    }
  `,
  styles: `
    :host { display: grid; place-items: center; min-height: 100dvh; background: #0d0f1c; }
    .back {
      position: fixed;
      top: calc(12px + env(safe-area-inset-top));
      inset-inline-start: 12px;
      z-index: 5;
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      font-weight: 700;
      text-decoration: none;
    }
    .frame { width: 100%; }
    @media (min-width: 600px) and (min-height: 760px) {
      .frame {
        --std-height: 844px;
        width: 390px;
        height: 844px;
        overflow: hidden;
        border-radius: 44px;
        box-shadow: 0 0 0 10px #22263a, 0 30px 80px rgba(0, 0, 0, 0.6);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SaveTheDatePreview {
  private readonly api = inject(SaveTheDateApi);
  protected readonly view = signal<SaveTheDateView | null>(this.api.draft());

  constructor() {
    // רענון של הדף (בלי טיוטה): ההגדרות השמורות
    if (!this.view()) {
      void this.api.get().then((s) =>
        this.view.set({
          eventAt: s.eventAt,
          display: s.display,
          hebrewText: s.hebrewText ?? '',
          afterNightfall: s.afterNightfall,
          headline: s.headline,
          subline: s.subline ?? '',
          location: s.location ?? '',
          showCountdown: s.showCountdown,
        }),
      );
    }
  }
}
