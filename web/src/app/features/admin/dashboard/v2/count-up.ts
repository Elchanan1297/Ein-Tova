import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';

/** מספר שעולה בספירה עד הערך (ומהערך הקודם בעדכון חי). בלי אנימציה למי שביקש פחות תנועה */
@Component({
  selector: 'app-count-up',
  template: `{{ shown() }}`,
  styles: `:host { font-variant-numeric: tabular-nums; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountUp {
  readonly value = input.required<number>();
  readonly decimals = input(0);

  protected readonly shown = signal('0');
  private current = 0;
  private frame = 0;

  constructor() {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    effect(() => {
      const to = Number.isFinite(this.value()) ? this.value() : 0;
      const dec = this.decimals();
      untracked(() => {
        cancelAnimationFrame(this.frame);
        const from = this.current;
        if (reduced || from === to) {
          this.current = to;
          this.shown.set(to.toFixed(dec));
          return;
        }
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / 1300);
          const x = from + (to - from) * (1 - Math.pow(1 - p, 3));
          this.current = p < 1 ? x : to;
          this.shown.set(this.current.toFixed(dec));
          if (p < 1) this.frame = requestAnimationFrame(step);
        };
        this.frame = requestAnimationFrame(step);
      });
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }
}
