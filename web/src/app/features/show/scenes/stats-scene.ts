import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CountUp } from '../../dashboard/charts/count-up';
import { familyColors } from '../../dashboard/charts/chart-theme';
import { awardsOf, podiumOf, raceRows } from '../../dashboard/charts/dash-model';
import { hardestOption, scaleFonts } from '../../dashboard/charts/dash-options';
import { DashStore } from '../../dashboard/charts/dash-store';
import { EChart } from '../../dashboard/charts/echart';

type Slide = 'families' | 'leaders' | 'questions';
const SLIDES: { id: Slide; title: string }[] = [
  { id: 'families', title: 'מרוץ המשפחות' },
  { id: 'leaders', title: 'המובילים' },
  { id: 'questions', title: 'השאלות' },
];
const SLIDE_MS = 14000;

/**
 * הדשבורד במסך הגדול (אחרי סיום המשחק): שלוש שקופיות שמתחלפות לבד, עם נתונים חיים.
 * 1) מרוץ המשפחות והמספרים של הערב 2) הפודיום ומי מצטיין במה 3) השאלות הקשות.
 * המצגת רצה כמנהל, ולכן קוראת את הדשבורד של המנהל (עם עדכון חי).
 */
@Component({
  selector: 'app-stats-scene',
  imports: [EChart, CountUp],
  providers: [DashStore],
  template: `
    @if (store.data(); as full) {
      <header class="top">
        <h1>המספרים של הערב</h1>
        <nav class="dots" aria-label="שקופיות">
          @for (s of slides; track s.id; let i = $index) {
            <span [class.on]="i === index()">{{ s.title }}</span>
          }
        </nav>
      </header>

      @for (s of [slide()]; track s) {
        <section class="slide">
          @switch (s) {
            @case ('families') {
              <div class="race panel lg">
                @for (f of race(); track f.familyId; let i = $index) {
                  <div class="rr" [style.--i]="i">
                    <span class="rk">{{ f.rnk }}</span>
                    <span class="rn"><b>{{ f.name }}</b><i>שיחקו {{ f.players }} מתוך {{ f.guests }}</i></span>
                    <span class="trk"><span class="fl" [style.width.%]="f.width" [style.--c]="f.color"></span></span>
                    <span class="sc">{{ byAverage() ? f.displayScore.toFixed(1) : f.displayScore }}</span>
                  </div>
                }
              </div>
              <div class="kpis">
                <div class="kpi panel lg"><b><app-count-up [value]="full.data.summary.finished" /></b><span>שיחקו עד הסוף</span></div>
                <div class="kpi panel lg"><b><app-count-up [value]="full.data.summary.correctPct" />%</b><span>תשובות נכונות</span></div>
                <div class="kpi panel lg">
                  <b>@if (full.data.summary.avgSec !== null) { <app-count-up [value]="full.data.summary.avgSec" [decimals]="1" /> } @else { - }</b>
                  <span>שניות בממוצע לתשובה</span>
                </div>
              </div>
            }
            @case ('leaders') {
              <div class="pod panel lg">
                @for (x of podium(); track x.p.guestId) {
                  <div class="pc" [attr.data-place]="x.place">
                    <div class="av" [style.--c]="colors().get(x.p.familyId)">{{ x.p.fullName.charAt(0) }}</div>
                    <b>{{ x.p.fullName }}</b>
                    <i>{{ x.p.familyName }}</i>
                    <div class="bar" [attr.data-place]="x.place">{{ x.p.score }}</div>
                  </div>
                }
              </div>
              <div class="awards">
                @for (a of awards(); track a.title; let i = $index) {
                  <div class="aw panel lg" [style.--c]="a.color" [style.--i]="i">
                    <span class="e" aria-hidden="true">{{ a.icon }}</span>
                    <span class="k">{{ a.title }}</span>
                    @if (a.f; as f) {
                      <b>{{ f.name }}</b>
                      <span class="v">{{ a.value }}</span>
                    } @else {
                      <span class="k">עוד אין נתונים</span>
                    }
                  </div>
                }
              </div>
            }
            @case ('questions') {
              <div class="panel lg chart">
                <h2>אילו שאלות היו קשות</h2>
                <app-echart [option]="hardest()" label="השאלות שהכי מעט ענו עליהן נכון" />
              </div>
              <div class="side">
                @if (hardestQ(); as q) {
                  <div class="panel lg q">
                    <span class="k">השאלה שהפילה את כולם</span>
                    <p>{{ q.body }}</p>
                    <b>רק {{ q.correctPct.toFixed(0) }}% צדקו</b>
                  </div>
                }
                @if (easiestQ(); as q) {
                  <div class="panel lg q easy">
                    <span class="k">השאלה שכולם ידעו</span>
                    <p>{{ q.body }}</p>
                    <b>{{ q.correctPct.toFixed(0) }}% צדקו</b>
                  </div>
                }
              </div>
            }
          }
        </section>
      }
    }
  `,
  styles: `
    :host { display: grid; grid-template-rows: auto 1fr; gap: 3vh; height: 100%; padding: 4vh 4vw; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 2vw; }
    h1 {
      margin: 0;
      font: 900 6.4vh / 1 var(--font-display);
      background: linear-gradient(180deg, #f6dfa0, #d9b66f 55%, #b08a48);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .dots { display: flex; gap: 1vw; }
    .dots span {
      padding: 0.8vh 1.4vw;
      border-radius: 99px;
      font-size: 2vh;
      font-weight: 700;
      color: rgba(248, 243, 234, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.5s;
      &.on { color: var(--color-gold); background: rgba(217, 182, 111, 0.2); border-color: rgba(217, 182, 111, 0.45); }
    }
    .slide { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2.4vw; min-height: 0; animation: slide-in 0.8s cubic-bezier(0.34, 1.5, 0.5, 1); }
    @keyframes slide-in { from { opacity: 0; transform: translateY(3vh) scale(0.98); } }
    .panel { padding: 3vh 2vw; border-radius: 3vh; min-height: 0; &::after { content: none; } }
    h2 { margin: 0 0 1vh; font: 700 3.4vh var(--font-display); color: var(--color-gold); }

    /* מרוץ */
    .race { display: grid; align-content: center; gap: 2.2vh; }
    .rr { display: grid; grid-template-columns: 6vh minmax(0, 28%) 1fr 9vh; align-items: center; gap: 1.4vw; animation: slide-in 0.8s calc(var(--i) * 0.08s) both; }
    .rk { display: grid; place-items: center; width: 5.6vh; height: 5.6vh; border-radius: 50%; font: 800 2.8vh var(--font-display); color: #2a2010; background: linear-gradient(150deg, #f6dfa0, #b08a48); }
    .rr:nth-child(n + 4) .rk { background: rgba(255, 255, 255, 0.12); color: var(--color-cream); }
    .rn { min-width: 0; b { display: block; font-size: 3.2vh; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } i { font-style: normal; font-size: 1.9vh; color: #9aa3c4; } }
    .trk { height: 3vh; border-radius: 99px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
    .fl {
      display: block;
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(270deg, color-mix(in srgb, var(--c) 60%, transparent), var(--c));
      box-shadow: 0 0 2.4vh color-mix(in srgb, var(--c) 50%, transparent);
      animation: grow-w 1.6s 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both;
      transition: width 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes grow-w { from { width: 0; } }
    .sc { font: 800 4vh var(--font-display); font-variant-numeric: tabular-nums; text-align: end; }

    .kpis { display: grid; gap: 2.4vh; align-content: center; }
    .kpi { display: grid; justify-items: center; gap: 0.6vh; b { font: 800 9vh / 1 var(--font-display); font-variant-numeric: tabular-nums; } span { font-size: 2.4vh; color: rgba(248, 243, 234, 0.75); } }

    /* פודיום */
    .pod { display: flex; align-items: flex-end; justify-content: center; gap: 2vw; padding-top: 6vh; }
    .pc { flex: 1; max-width: 22vh; text-align: center; min-width: 0; }
    .av {
      position: relative;
      display: grid;
      place-items: center;
      width: 10vh;
      height: 10vh;
      margin: 0 auto 1.2vh;
      border-radius: 50%;
      font: 800 4vh var(--font-display);
      color: #2a2010;
      background: linear-gradient(150deg, #f6dfa0, #b08a48);
      box-shadow: 0 0 0 0.5vh color-mix(in srgb, var(--c, #d9b66f) 50%, transparent), 0 1.4vh 3vh rgba(0, 0, 0, 0.4);
    }
    .pc[data-place='1'] .av { width: 13vh; height: 13vh; font-size: 5vh; &::before { content: '♛'; position: absolute; top: -5vh; font-size: 4.6vh; color: var(--color-gold); text-shadow: 0 0 2vh rgba(217, 182, 111, 0.8); } }
    .pc b { display: block; font-size: 2.8vh; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pc i { display: block; font-style: normal; font-size: 1.9vh; color: #9aa3c4; }
    .bar {
      display: grid;
      place-items: start center;
      margin-top: 1.4vh;
      padding-top: 1.6vh;
      border-radius: 2vh 2vh 0.6vh 0.6vh;
      background: linear-gradient(180deg, rgba(217, 182, 111, 0.6), rgba(217, 182, 111, 0.06));
      border: 1px solid rgba(217, 182, 111, 0.4);
      font: 800 5vh var(--font-display);
      transform-origin: bottom;
      animation: grow 1.2s cubic-bezier(0.34, 1.5, 0.5, 1) both;
      &[data-place='1'] { height: 30vh; animation-delay: 0.5s; }
      &[data-place='2'] { height: 22vh; animation-delay: 0.3s; }
      &[data-place='3'] { height: 16vh; animation-delay: 0.1s; }
    }
    @keyframes grow { from { transform: scaleY(0); } }
    .awards { display: grid; grid-template-columns: 1fr 1fr; gap: 2vh; align-content: center; }
    .aw {
      position: relative;
      display: grid;
      gap: 0.4vh;
      overflow: hidden;
      animation: slide-in 0.8s calc(0.3s + var(--i) * 0.1s) both;
      &::before { content: ''; position: absolute; inset-inline-start: 0; top: 0; bottom: 0; width: 0.6vh; background: var(--c); }
      .e { font-size: 3.6vh; }
      .k { font-size: 2vh; color: #9aa3c4; font-weight: 600; }
      b { font-size: 2.8vh; color: var(--c); }
      .v { font: 800 4.4vh var(--font-display); font-variant-numeric: tabular-nums; }
    }

    /* שאלות */
    .chart { display: grid; grid-template-rows: auto 1fr; }
    .chart app-echart { --chart-h: 100%; height: 100%; min-height: 40vh; }
    .side { display: grid; gap: 2.4vh; align-content: center; }
    .q { display: grid; gap: 1vh; .k { font-size: 2.2vh; color: #e58a9b; font-weight: 700; } p { margin: 0; font-size: 3.2vh; font-weight: 600; line-height: 1.35; } b { font-size: 2.8vh; color: var(--color-gold); } }
    .q.easy .k { color: #7fd1b0; }

    @media (prefers-reduced-motion: reduce) {
      .slide, .rr, .fl, .bar, .aw { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsScene {
  protected readonly store = inject(DashStore);
  protected readonly slides = SLIDES;
  protected readonly index = signal(0);
  protected readonly slide = computed(() => SLIDES[this.index()].id);

  private readonly d = computed(() => this.store.data()?.data ?? null);
  protected readonly colors = computed(() => familyColors((this.d()?.families ?? []).map((f) => f.familyId)));
  protected readonly byAverage = computed(() => this.d()?.families[0]?.rankBy === 'Average');
  protected readonly race = computed(() => raceRows(this.d()?.families ?? [], this.colors(), true).slice(0, 8));
  protected readonly podium = computed(() => podiumOf(this.d()?.players ?? []));
  protected readonly awards = computed(() =>
    awardsOf(this.d()?.families ?? [], new Map((this.store.data()?.charts.families ?? []).map((f) => [f.familyId, f])), this.colors()),
  );
  private readonly answered = computed(() => (this.d()?.questions ?? []).filter((q) => q.answered > 0));
  protected readonly hardestQ = computed(() => [...this.answered()].sort((a, b) => a.correctPct - b.correctPct)[0] ?? null);
  protected readonly easiestQ = computed(() => {
    const easy = [...this.answered()].sort((a, b) => b.correctPct - a.correctPct)[0] ?? null;
    return easy && easy.questionId !== this.hardestQ()?.questionId ? easy : null;
  });
  /** הגרף בגודל מסך: הטקסטים מוגדלים לפי גובה החלון */
  protected readonly hardest = computed(() => {
    const factor = Math.min(2.4, Math.max(1, innerHeight / 560));
    const wrong = new Map((this.store.data()?.charts.topWrong ?? []).map((w) => [w.questionId, w]));
    return scaleFonts(hardestOption(this.d()?.questions ?? [], wrong, factor), factor);
  });

  constructor() {
    const timer = setInterval(() => this.index.update((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
