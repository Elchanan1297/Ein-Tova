import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Leaderboard } from '../../leaderboard/data/leaderboard-models';

/** לוח התוצאות במסך הגדול: פסים לפי משפחה (מתעדכנים חי) ושחקנים מובילים. */
@Component({
  selector: 'app-leaderboard-scene',
  imports: [DecimalPipe],
  template: `
    <h1 class="rise">לוח התוצאות</h1>
    @if (board(); as b) {
      <div class="layout">
        <ol class="families" role="list">
          @for (f of b.families; track f.familyId; let i = $index) {
            <li class="rise" [style.--d.s]="0.05 * i" [attr.data-rank]="f.rnk <= 3 ? f.rnk : null">
              <span class="rank">{{ f.rnk }}</span>
              <div class="bar-wrap">
                <span class="name">{{ f.name }}</span>
                <span class="bar"><span [style.width.%]="pct(f.displayScore)"></span></span>
              </div>
              <span class="score">{{ f.displayScore | number: '1.0-1' }}</span>
            </li>
          }
        </ol>
        @if (b.top.length) {
          <aside class="top lg rise" style="--d: 0.3s">
            <h2>השחקנים המובילים</h2>
            <ol role="list">
              @for (p of b.top.slice(0, 6); track $index) {
                <li><span class="pos">{{ $index + 1 }}</span><span class="who">{{ p.fullName }}<small>{{ p.familyName }}</small></span><b>{{ p.score }}/{{ p.total }}</b></li>
              }
            </ol>
          </aside>
        }
      </div>
      <p class="foot">{{ finished() }} סיימו את המשחק{{ b.families[0]?.rankBy === 'Average' ? ' · דירוג לפי ממוצע לשחקן' : '' }}</p>
    }
  `,
  styles: `
    :host { display: grid; grid-template-rows: auto 1fr auto; gap: 3vh; height: 100%; padding: 5vh 5vw 4vh; }
    h1 { margin: 0; text-align: center; font-size: 7vh; }
    .layout { display: grid; grid-template-columns: 1fr minmax(0, 30vw); gap: 3vw; min-height: 0; }
    .families { display: grid; align-content: start; gap: 1.6vh; margin: 0; padding: 0; list-style: none; overflow: hidden; }
    .families li { display: flex; align-items: center; gap: 1.6vw; }
    .rank {
      display: grid;
      place-items: center;
      flex: none;
      width: 7vh;
      height: 7vh;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      font-size: 3.2vh;
      font-weight: 700;
    }
    [data-rank='1'] .rank { background: linear-gradient(135deg, #f6dfa0, #c99d55); color: var(--color-midnight); }
    [data-rank='2'] .rank { background: linear-gradient(135deg, #f1f3f8, #a9b0c2); color: var(--color-midnight); }
    [data-rank='3'] .rank { background: linear-gradient(135deg, #e6a57a, #a8623d); color: var(--color-midnight); }
    .bar-wrap { display: grid; gap: 0.6vh; flex: 1; min-width: 0; }
    .name { font-size: 3.4vh; font-weight: 700; }
    .bar { height: 2.2vh; border-radius: 99px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
    .bar span {
      display: block;
      height: 100%;
      min-width: 1.2vh;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--color-gold-deep), #f2d698);
      transition: width 1.2s var(--motion-spring);
    }
    .score { width: 10vw; text-align: end; font: 700 6vh / 1 var(--font-display); color: var(--color-gold); }
    .top { align-self: start; padding: 2.4vh 2vw; border-radius: 3vh; }
    .top h2 { margin: 0 0 1.4vh; font-size: 3.4vh; text-align: center; }
    .top ol { display: grid; gap: 1.2vh; margin: 0; padding: 0; list-style: none; }
    .top li { display: flex; align-items: center; gap: 1vw; font-size: 2.6vh; }
    .pos { width: 2vw; font-weight: 700; color: var(--color-gold); text-align: center; }
    .who { flex: 1; display: grid; small { font-size: 1.9vh; color: rgba(248, 243, 234, 0.6); } }
    .foot { margin: 0; text-align: center; font-size: 2.4vh; color: rgba(248, 243, 234, 0.7); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderboardScene {
  readonly board = input.required<Leaderboard | null>();

  private readonly max = computed(() => Math.max(1, ...(this.board()?.families.map((f) => f.displayScore) ?? [1])));
  protected readonly finished = computed(() => this.board()?.families.reduce((s, f) => s + f.finished, 0) ?? 0);

  protected pct(score: number): number {
    return (score / this.max()) * 100;
  }
}
