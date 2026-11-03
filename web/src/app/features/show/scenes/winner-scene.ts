import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { Winner } from '../data/show-api';

/** הכרזת הזוכה: זוהר זהב, שם המשפחה הענק וקונפטי. */
@Component({
  selector: 'app-winner-scene',
  imports: [DecimalPipe, Icon],
  template: `
    <div class="confetti" aria-hidden="true">
      @for (c of confetti; track $index) {
        <i [style.left.%]="c.x" [style.animation-delay.s]="c.delay" [style.animation-duration.s]="c.dur" [style.background]="c.color"></i>
      }
    </div>
    <div class="center">
      <span class="trophy rise"><app-icon name="trophy" /></span>
      <p class="label rise" style="--d: 0.3s">{{ (winner()?.families?.length ?? 0) > 1 ? 'תיקו! הזוכים' : 'המשפחה הזוכה' }}</p>
      @for (f of winner()?.families ?? []; track f.name; let i = $index) {
        <h1 class="name rise" [style.--d.s]="0.7 + i * 0.2">{{ f.name }}</h1>
      }
      @if (winner()?.families?.[0]; as f) {
        <p class="score rise" style="--d: 1.2s">
          {{ f.displayScore | number: '1.0-1' }} {{ winner()!.rankBy === 'Average' ? 'נקודות בממוצע לשחקן' : 'נקודות' }}
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: grid;
      place-items: center;
      height: 100%;
      overflow: hidden;
      background: radial-gradient(50% 55% at 50% 45%, rgba(217, 182, 111, 0.35), transparent 70%);
    }
    .center { display: grid; justify-items: center; gap: 2vh; text-align: center; z-index: 1; }
    .trophy {
      display: grid;
      place-items: center;
      width: 18vh;
      height: 18vh;
      border-radius: 50%;
      background: linear-gradient(135deg, #f6dfa0, #c99d55);
      color: var(--color-midnight);
      box-shadow: 0 0 10vh rgba(217, 182, 111, 0.6);
      app-icon { width: 10vh; height: 10vh; }
    }
    .label { margin: 0; font-size: 4vh; font-weight: 700; letter-spacing: 0.12em; color: var(--color-gold); }
    .name {
      margin: 0;
      font-size: 14vh;
      line-height: 1;
      background: linear-gradient(180deg, #fff3d1, var(--color-gold) 55%, var(--color-gold-deep));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .score { margin: 0; font-size: 4vh; color: rgba(248, 243, 234, 0.85); }
    .confetti i {
      position: absolute;
      top: -4vh;
      width: 1vh;
      height: 2.2vh;
      border-radius: 2px;
      animation: fall linear infinite;
    }
    @keyframes fall {
      to { transform: translateY(110vh) rotate(720deg); }
    }
    @media (prefers-reduced-motion: reduce) { .confetti { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinnerScene {
  readonly winner = input.required<Winner | null>();

  protected readonly confetti = Array.from({ length: 48 }, () => ({
    x: Math.random() * 100,
    delay: Math.random() * 4,
    dur: 3.5 + Math.random() * 3,
    color: ['#f6dfa0', '#d9b66f', '#be9550', '#f8f3ea', '#6070be'][Math.floor(Math.random() * 5)],
  }));
}
