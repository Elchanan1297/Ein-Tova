import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** סיכום אחרי המשחק: ציון והפניה ללוח התוצאות. */
@Component({
  selector: 'app-game-summary',
  imports: [RouterLink],
  template: `
    <section class="card lg rise">
      <p class="label">סיימת את המשחק!</p>
      <p class="score"><strong>{{ score() }}</strong> / {{ total() }}</p>
      <p class="msg">{{ message() }}</p>
    </section>
    <a class="b lg gs press cta rise" style="--d: 0.1s" routerLink="/leaderboard">ללוח התוצאות</a>
    <a class="b press link rise" style="--d: 0.16s" routerLink="/home">חזרה לבית</a>
  `,
  styles: `
    :host { display: grid; gap: 16px; justify-items: center; text-align: center; }
    .card { display: grid; gap: 4px; width: 100%; padding: 28px 20px; border-radius: var(--radius-card); }
    p { margin: 0; }
    .label { font-weight: 700; color: rgba(248, 243, 234, 0.8); }
    .score { font: 700 30px var(--font-display); color: rgba(248, 243, 234, 0.7); }
    .score strong { font-size: 76px; line-height: 1.1; color: var(--color-gold); }
    .msg { font-size: 17px; }
    .cta { width: min(100%, 300px); padding: 15px; border-radius: var(--radius-pill); font-size: 18px; font-weight: 700; text-align: center; text-decoration: none; }
    .link { color: var(--color-gold); text-decoration: none; font-weight: 600; padding: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameSummary {
  readonly score = input.required<number>();
  readonly total = input.required<number>();

  protected readonly message = computed(() => {
    const ratio = this.score() / Math.max(1, this.total());
    if (ratio >= 0.8) return 'מכירים את אבא מצוין! עין טובה עליכם.';
    if (ratio >= 0.5) return 'יפה מאוד! עכשיו אתם יודעים עוד כמה דברים.';
    return 'הנה הזדמנות להכיר את אבא קצת יותר 😊';
  });
}
