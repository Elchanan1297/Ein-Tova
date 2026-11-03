import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const R = 20;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** טבעת זמן שמתכווצת; משנה צבע ב־3 השניות האחרונות. תצוגה בלבד. */
@Component({
  selector: 'app-timer-ring',
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle class="track" cx="24" cy="24" [attr.r]="r" />
      <circle class="fill" cx="24" cy="24" [attr.r]="r" [attr.stroke-dasharray]="c" [attr.stroke-dashoffset]="offset()" />
    </svg>
    <span class="num" role="timer" [attr.aria-label]="seconds() + ' שניות'">{{ seconds() }}</span>
  `,
  styles: `
    :host { position: relative; display: grid; place-items: center; width: 48px; height: 48px; }
    svg { position: absolute; inset: 0; rotate: -90deg; }
    circle { fill: none; stroke-width: 3.5; }
    .track { stroke: rgba(255, 255, 255, 0.14); }
    .fill {
      stroke: var(--color-gold);
      stroke-linecap: round;
      transition: stroke-dashoffset 1s linear, stroke 0.3s;
    }
    .num { font-size: 17px; font-weight: 700; color: var(--color-cream); }
    :host(.urgent) .fill { stroke: #e8826f; }
    :host(.urgent) .num { color: #f4a493; animation: pulse 1s ease-in-out infinite; }
  `,
  host: { '[class.urgent]': 'seconds() <= 3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimerRing {
  readonly seconds = input.required<number>();
  readonly limit = input.required<number>();

  protected readonly r = R;
  protected readonly c = CIRCUMFERENCE;
  protected readonly offset = computed(
    () => CIRCUMFERENCE * (1 - Math.min(1, this.seconds() / Math.max(1, this.limit()))),
  );
}
