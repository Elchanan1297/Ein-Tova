import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { TimerRing } from '../../game/ui/timer-ring';
import { ShowQuiz } from '../data/show-api';

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

/**
 * החידון במסך הגדול, למי שאין סמארטפון: השאלה, ארבע תשובות וטיימר (לפי הזמן שנקבע במשחק).
 * בסוף הזמן (או בלחיצה בשלט) התשובה הנכונה נדלקת, ומופיעים "ידעתם?" וכמה צדקו בטלפון.
 */
@Component({
  selector: 'app-quiz-scene',
  imports: [TimerRing],
  template: `
    @if (quiz(); as z) {
      @if (z.question; as q) {
        <!-- שאלה חדשה = אנימציית כניסה מחדש (החשיפה לא מאנימה את השאלה שוב) -->
        @for (k of [z.index]; track k) {
        <header class="top">
          <span class="progress rise">שאלה {{ z.index }} מתוך {{ z.total }}</span>
          @if (z.phase === 'question') {
            <div class="timer rise"><app-timer-ring [seconds]="secondsLeft()" [limit]="q.timeLimitSec" /></div>
          }
        </header>

        <div class="body" [class.with-image]="q.imageUrl">
          @if (q.imageUrl) {
            <img class="image rise" [src]="q.imageUrl" alt="" />
          }
          <h1 class="question rise" style="--d: 0.08s">{{ q.body }}</h1>
        </div>

        <ol class="options" role="list" [class.revealed]="z.phase === 'reveal'">
          @for (o of q.options; track o.id; let i = $index) {
            <li class="option lg rise" [style.--d.s]="0.15 + 0.07 * i" [class.correct]="o.correct === true" [class.wrong]="o.correct === false">
              <span class="letter">{{ letters[i] }}</span>
              <span class="text">{{ o.body }}</span>
            </li>
          }
        </ol>

        @if (z.phase === 'reveal') {
          <footer class="reveal">
            @if (q.fact) {
              <p class="fact lg rise"><b>ידעתם?</b> {{ q.fact }}</p>
            }
            @if (z.stats?.answered) {
              <p class="stats rise" style="--d: 0.15s">{{ pct(z.stats!) }}% מהמשחקים בטלפון ענו נכון</p>
            }
          </footer>
        }
        }
      } @else {
        <div class="done">
          <h1 class="rise">זהו, סיימנו!</h1>
          <p class="rise" style="--d: 0.15s">{{ z.total }} שאלות על אבא. עכשיו נראה מי ניצח.</p>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto auto;
      gap: 3vh;
      height: 100%;
      padding: 5vh 6vw;
    }
    .top { display: flex; align-items: center; justify-content: space-between; min-height: 14vh; }
    .progress { font-size: 2.8vh; font-weight: 600; letter-spacing: 0.08em; color: var(--color-gold); }
    // הטבעת של המשחק בטלפון, מוגדלת למסך
    .timer { width: 14vh; height: 14vh; display: grid; place-items: center; }
    .timer app-timer-ring { scale: calc(14vh / 48px); }

    .body { display: grid; align-content: center; justify-items: center; gap: 3vh; text-align: center; }
    .body.with-image { grid-template-columns: auto 1fr; align-items: center; gap: 4vw; }
    .image { max-height: 34vh; max-width: 34vw; border-radius: 2vh; box-shadow: 0 2vh 6vh rgba(0, 0, 0, 0.4); }
    .question { margin: 0; font: 700 6vh / 1.25 var(--font-display); color: var(--color-cream); text-wrap: balance; }

    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4vh 2vw; margin: 0; padding: 0; list-style: none; }
    .option {
      display: flex;
      align-items: center;
      gap: 1.6vw;
      padding: 2.4vh 2vw;
      border-radius: 2.4vh;
      font-size: 3.6vh;
      font-weight: 600;
      transition: background-color 0.6s, box-shadow 0.6s, scale 0.6s var(--motion-spring, ease);
      &::after { content: none; }
    }
    .letter {
      flex: none;
      display: grid;
      place-items: center;
      width: 6vh;
      height: 6vh;
      border-radius: 50%;
      background: rgba(217, 182, 111, 0.18);
      color: var(--color-gold);
      font-weight: 700;
    }
    // חשיפה: הנכונה בזהב, השאר מתעמעמות
    // מעמעמים את התוכן (אנימציית הכניסה מחזיקה את ה־opacity וה־filter של הכרטיס עצמו)
    .option > * { transition: opacity 0.6s; }
    .revealed .wrong > * { opacity: 0.3; }
    .revealed .correct {
      background-color: rgba(217, 182, 111, 0.3);
      box-shadow: 0 0 0 0.4vh var(--color-gold), 0 0 6vh rgba(217, 182, 111, 0.45);
      scale: 1.03;
      .letter { background: var(--color-gold); color: #1e2235; }
    }

    .reveal { display: grid; gap: 1.4vh; justify-items: center; text-align: center; }
    .fact { margin: 0; max-width: 80vw; padding: 2vh 3vw; border-radius: 2.4vh; font-size: 3vh; line-height: 1.45; &::after { content: none; } b { color: var(--color-gold); } }
    .stats { margin: 0; font-size: 2.6vh; color: rgba(248, 243, 234, 0.75); }

    .done { grid-row: 1 / -1; display: grid; place-content: center; justify-items: center; gap: 3vh; text-align: center; }
    .done h1 { margin: 0; font: 900 12vh / 1 var(--font-display); color: var(--color-gold); }
    .done p { margin: 0; font-size: 3.6vh; color: rgba(248, 243, 234, 0.85); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizScene {
  readonly quiz = input.required<ShowQuiz | null>();
  /** הפרש שעון השרת מהמחשב */
  readonly clockOffset = input(0);

  protected readonly letters = LETTERS;
  private readonly now = signal(Date.now());

  protected readonly secondsLeft = computed(() => {
    const ends = this.quiz()?.endsAt;
    if (!ends) return 0;
    return Math.max(0, Math.ceil((Date.parse(ends) - (this.now() + this.clockOffset())) / 1000));
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected pct(s: { answered: number; correct: number }): number {
    return Math.round((100 * s.correct) / Math.max(1, s.answered));
  }
}
