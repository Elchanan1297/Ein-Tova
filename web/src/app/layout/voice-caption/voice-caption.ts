import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VoicePlayer } from '../../core/audio/voice-player';
import { Icon } from '../../shared/ui/icon/icon';

/** תמלול הקול שמתנגן, סימון "נוצר בבינה מלאכותית" וכפתור השתקה. מוצג מעל כל המסכים. */
@Component({
  selector: 'app-voice-caption',
  imports: [Icon],
  template: `
    @if (voice.caption(); as text) {
      <aside class="toast lg" role="status" aria-live="polite">
        <span class="wave" aria-hidden="true"><app-icon name="volume" /></span>
        <div class="body">
          <p class="text">אבא: ״{{ text }}״</p>
          <p class="ai">קול שנוצר בבינה מלאכותית</p>
        </div>
        <button type="button" class="mute b press" aria-label="השתקת הקולות" (click)="voice.toggleMute()">
          <app-icon name="volume-off" />
        </button>
      </aside>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset-inline: 0;
      top: calc(12px + env(safe-area-inset-top));
      z-index: 50;
      display: flex;
      justify-content: center;
      padding-inline: 12px;
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      width: min(100%, 520px);
      padding: 10px 10px 10px 14px;
      border-radius: 22px;
      background-color: rgba(30, 34, 53, 0.72);
      pointer-events: auto;
      animation: drop 0.5s var(--motion-spring) both;
      &::after { content: none; }
    }
    .wave {
      display: grid;
      place-items: center;
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(217, 182, 111, 0.24);
      color: var(--color-gold);
      animation: pulse 1.2s ease-in-out infinite;
      app-icon { width: 20px; height: 20px; }
    }
    .body { flex: 1; min-width: 0; }
    p { margin: 0; }
    .text { font-size: 15px; font-weight: 600; line-height: 1.4; }
    .ai { font-size: 11px; color: rgba(248, 243, 234, 0.6); }
    .mute {
      display: grid;
      place-items: center;
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      color: rgba(248, 243, 234, 0.8);
      app-icon { width: 20px; height: 20px; }
    }
    // מסך גדול (מצגת): התמלול צריך להיקרא מכל האולם
    @media (min-width: 1100px) {
      .toast { width: min(100%, 60vw); padding: 1.4vh 1.4vh 1.4vh 2vw; border-radius: 3vh; }
      .wave, .mute { width: 6vh; height: 6vh; app-icon { width: 3vh; height: 3vh; } }
      .text { font-size: 3.2vh; }
      .ai { font-size: 1.8vh; }
    }
    @keyframes drop {
      from { opacity: 0; transform: translateY(-24px) scale(0.96); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceCaption {
  protected readonly voice = inject(VoicePlayer);
}
