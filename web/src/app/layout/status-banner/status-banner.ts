import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStatus } from '../../core/pwa/app-status';

/** הודעה קטנה מעל סרגל הטאבים: אין רשת, או שיש גרסה חדשה. */
@Component({
  selector: 'app-status-banner',
  template: `
    @if (!status.online()) {
      <p class="pill lg" role="status">אין חיבור לאינטרנט. התוכנית והברכות זמינים, המשחק יחזור כשיהיה חיבור.</p>
    } @else if (status.updateReady()) {
      <p class="pill lg" role="status">
        יש גרסה חדשה
        <button type="button" class="b gs press" (click)="status.applyUpdate()">רענון</button>
      </p>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset-inline: 0;
      bottom: calc(96px + env(safe-area-inset-bottom));
      z-index: 30;
      display: flex;
      justify-content: center;
      padding-inline: 16px;
      pointer-events: none;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 520px;
      margin: 0;
      padding: 10px 16px;
      border-radius: 18px;
      background-color: rgba(30, 34, 53, 0.82);
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      pointer-events: auto;
      animation: rise 0.5s var(--motion-ease-out) both;
      &::after { content: none; }
    }
    button { padding: 6px 14px; border-radius: var(--radius-pill); font-weight: 700; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBanner {
  protected readonly status = inject(AppStatus);
}
