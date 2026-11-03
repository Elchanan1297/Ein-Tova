import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VoicePlayer } from '../../core/audio/voice-player';
import { Icon } from '../../shared/ui/icon/icon';

/** כפתור קבוע להשתקה/הפעלה של הקולות של אבא. */
@Component({
  selector: 'app-mute-button',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="b lg press"
      [attr.aria-label]="voice.muted() ? 'הפעלת הקולות' : 'השתקת הקולות'"
      [attr.aria-pressed]="voice.muted()"
      (click)="voice.toggleMute()"
    >
      <app-icon [name]="voice.muted() ? 'volume-off' : 'volume'" />
    </button>
  `,
  styles: `
    :host {
      position: fixed;
      top: calc(14px + env(safe-area-inset-top));
      left: 14px;
      z-index: 20;
    }
    button {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: var(--color-gold);
      &::after { content: none; }
    }
    app-icon { width: 20px; height: 20px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MuteButton {
  protected readonly voice = inject(VoicePlayer);
}
