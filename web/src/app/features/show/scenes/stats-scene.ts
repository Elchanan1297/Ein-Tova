import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DASHBOARD_SOURCE, DashboardStore } from '../../dashboard/data/dashboard-store';

/**
 * הדשבורד במסך הגדול (אחרי סיום המשחק): המספרים של הערב, המשפחות, המהירים ביותר והשאלה הכי קשה.
 * המצגת רצה כמנהל, ולכן קוראת את הדשבורד של המנהל (רענון כל 4 שניות).
 */
@Component({
  selector: 'app-stats-scene',
  imports: [DecimalPipe],
  providers: [DashboardStore, { provide: DASHBOARD_SOURCE, useValue: { url: '/api/admin/dashboard', refreshMs: 4000 } }],
  template: `
    @if (store.data(); as d) {
      <h1 class="rise">המספרים של הערב</h1>

      <div class="kpis">
        <div class="kpi rise" style="--d: 0.08s"><b>{{ d.summary.finished }}</b><span>שיחקו עד הסוף</span></div>
        <div class="kpi rise" style="--d: 0.14s"><b>{{ d.summary.correctPct | number: '1.0-0' }}%</b><span>תשובות נכונות</span></div>
        <div class="kpi rise" style="--d: 0.2s">
          <b>{{ d.summary.avgSec !== null ? (d.summary.avgSec | number: '1.1-1') : '-' }}</b><span>שניות בממוצע לתשובה</span>
        </div>
      </div>

      <div class="grid">
        <section class="panel lg rise" style="--d: 0.26s">
          <h2>המשפחות</h2>
          <ol class="bars" role="list">
            @for (f of families(); track f.familyId; let i = $index) {
              <li [attr.data-rank]="f.rnk">
                <span class="rank">{{ f.rnk }}</span>
                <span class="name">{{ f.name }}</span>
                <span class="track"><i [style.width.%]="(100 * f.displayScore) / maxScore()" [style.--i]="i"></i></span>
                <span class="num">{{ f.displayScore | number: '1.0-1' }}</span>
                <span class="sec">{{ f.avgSec !== null ? (f.avgSec | number: '1.1-1') + ' ש׳' : '' }}</span>
              </li>
            }
          </ol>
        </section>

        <div class="side">
          <section class="panel lg rise" style="--d: 0.34s">
            <h2>⚡ הכי מהירים</h2>
            <ol class="podium" role="list">
              @for (p of fastest(); track p.guestId; let i = $index) {
                <li>
                  <span class="medal" [attr.data-place]="i + 1">{{ i + 1 }}</span>
                  <span class="who">{{ p.fullName }}<small>{{ p.familyName }}</small></span>
                  <span class="sec">{{ p.avgSec | number: '1.1-1' }} ש׳</span>
                </li>
              } @empty {
                <li class="empty">עוד אין מי שסיים</li>
              }
            </ol>
          </section>

          @if (hardest(); as q) {
            <section class="panel lg rise" style="--d: 0.42s">
              <h2>השאלה שהפילה את כולם</h2>
              <p class="q">{{ q.body }}</p>
              <p class="pct">רק {{ q.correctPct | number: '1.0-0' }}% צדקו</p>
            </section>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: grid; grid-template-rows: auto auto 1fr; gap: 3vh; height: 100%; padding: 5vh 5vw; }
    h1 { margin: 0; text-align: center; font: 900 7vh / 1 var(--font-display); color: var(--color-gold); }
    h2 { margin: 0 0 1.6vh; font: 700 3.4vh var(--font-display); color: var(--color-gold); }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2vw; }
    .kpi {
      display: grid;
      justify-items: center;
      gap: 0.6vh;
      padding: 2vh 1vw;
      border-radius: 2.4vh;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(217, 182, 111, 0.28);
      b { font: 800 8vh / 1 var(--font-display); color: var(--color-cream); font-variant-numeric: tabular-nums; }
      span { font-size: 2.4vh; color: rgba(248, 243, 234, 0.75); }
    }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr; align-items: start; gap: 2vw; min-height: 0; }
    .side { display: grid; gap: 2vw; align-content: start; }
    .panel { padding: 2.6vh 2vw; border-radius: 2.4vh; &::after { content: none; } }
    .bars { display: grid; gap: 1.4vh; margin: 0; padding: 0; list-style: none; }
    .bars li { display: grid; grid-template-columns: 4vh minmax(0, 24%) 1fr auto 8vh; align-items: center; gap: 1.2vw; font-size: 2.8vh; }
    .rank { font-weight: 700; color: var(--color-gold); text-align: center; }
    .name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 2.4vh; border-radius: 1.2vh; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
    .track > i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--color-gold-deep), var(--color-gold));
      transform-origin: right;
      animation: grow 1.2s calc(0.4s + var(--i) * 0.1s) var(--motion-ease-out) both;
    }
    [data-rank='1'] .track > i { box-shadow: 0 0 2vh rgba(217, 182, 111, 0.6); }
    .num { font-weight: 800; font-variant-numeric: tabular-nums; }
    .sec { font-size: 2.2vh; color: rgba(248, 243, 234, 0.7); text-align: end; white-space: nowrap; }
    .podium { display: grid; gap: 1.4vh; margin: 0; padding: 0; list-style: none; }
    .podium li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1vw; font-size: 2.8vh; }
    .podium .sec { font-size: 2.6vh; color: var(--color-gold); font-weight: 700; }
    .medal {
      display: grid;
      place-items: center;
      width: 5vh;
      height: 5vh;
      border-radius: 50%;
      font-weight: 800;
      background: rgba(255, 255, 255, 0.1);
      &[data-place='1'] { background: var(--color-gold); color: #1e2235; }
      &[data-place='2'] { background: #c9ccd6; color: #1e2235; }
      &[data-place='3'] { background: #b0815a; color: #1e2235; }
    }
    .who { display: grid; font-weight: 700; small { font-size: 2vh; font-weight: 400; color: rgba(248, 243, 234, 0.6); } }
    .empty { font-size: 2.4vh; color: rgba(248, 243, 234, 0.6); }
    .q { margin: 0; font-size: 3vh; font-weight: 600; line-height: 1.4; }
    .pct { margin: 1vh 0 0; font-size: 2.6vh; color: var(--color-gold); }
    @keyframes grow { from { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .track > i { animation: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsScene {
  protected readonly store = inject(DashboardStore);

  protected readonly families = computed(() => (this.store.data()?.families ?? []).filter((f) => f.players > 0).slice(0, 8));
  protected readonly maxScore = computed(() => Math.max(1, ...this.families().map((f) => f.displayScore)));
  protected readonly fastest = computed(() =>
    (this.store.data()?.players ?? [])
      .filter((p) => p.status === 'done' && p.avgSec !== null)
      .sort((a, b) => a.avgSec! - b.avgSec!)
      .slice(0, 3),
  );
  protected readonly hardest = computed(() => {
    const qs = (this.store.data()?.questions ?? []).filter((q) => q.answered > 0);
    return qs.reduce<(typeof qs)[number] | null>((best, q) => (best === null || q.correctPct < best.correctPct ? q : best), null);
  });
}
