import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { VoicePlayer } from '../../core/audio/voice-player';
import { GameApi } from './data/game-api';
import { AnswerOption, AnswerResult, QuestionHead } from './data/game-models';

type Revealed = Extract<AnswerResult, { status: 'OK' }>;

export type GameState =
  | { phase: 'loading' }
  | { phase: 'intro' }
  | { phase: 'question'; q: QuestionHead; options: AnswerOption[]; deadline: number }
  | { phase: 'revealed'; q: QuestionHead; options: AnswerOption[]; result: Revealed }
  | { phase: 'finished'; score: number; total: number }
  | { phase: 'closed' }
  | { phase: 'noQuestions' }
  | { phase: 'error' };

/**
 * מצב המשחק של השחקן. מסופק ברמת הדף (נהרס כשיוצאים מהמשחק).
 * הטיימר כאן הוא תצוגה בלבד, השרת מודד את הזמן האמיתי.
 */
@Injectable()
export class GameStore {
  private readonly api = inject(GameApi);
  private readonly voice = inject(VoicePlayer);

  readonly state = signal<GameState>({ phase: 'loading' });
  readonly selectedId = signal<number | null>(null);
  readonly busy = signal(false);
  readonly secondsLeft = signal(0);

  /** אחוז השאלות שנענו (כולל הנוכחית אחרי מענה) */
  readonly progress = computed(() => {
    const s = this.state();
    if (s.phase !== 'question' && s.phase !== 'revealed') return 0;
    const answered = s.q.position - (s.phase === 'revealed' ? 0 : 1);
    return Math.round((answered / s.q.total) * 100);
  });

  constructor() {
    const timer = setInterval(() => this.tick(), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    void this.load();
  }

  async start(): Promise<void> {
    await this.run(async () => {
      const res = await this.api.start();
      if (res.status === 'Closed') this.state.set({ phase: 'closed' });
      else if (res.status === 'NoQuestions') this.state.set({ phase: 'noQuestions' });
      else {
        if (res.status === 'OK') void this.voice.play('GameStart');
        await this.load();
      }
    });
  }

  select(optionId: number): void {
    if (this.state().phase === 'question' && !this.busy()) this.selectedId.set(optionId);
  }

  /** כפתור "המשך": לפני מענה שולח את הבחירה, אחרי מענה עובר לשאלה הבאה. */
  async continue(): Promise<void> {
    const s = this.state();
    if (s.phase === 'question') {
      const id = this.selectedId();
      if (id !== null) await this.submit(() => this.api.answer(id));
    } else if (s.phase === 'revealed') {
      if (s.result.isFinished) {
        this.state.set({ phase: 'finished', score: s.result.score, total: s.result.total });
        void this.voice.play('GameEnd');
      } else await this.load();
    }
  }

  async load(): Promise<void> {
    await this.run(async () => {
      const { head, options } = await this.api.next();
      this.selectedId.set(null);
      switch (head.status) {
        case 'NoAttempt':
          this.state.set({ phase: 'intro' });
          break;
        case 'Finished':
          this.state.set({ phase: 'finished', score: head.score, total: head.total });
          break;
        case 'Closed':
          this.state.set({ phase: 'closed' });
          break;
        case 'InProgress':
          this.secondsLeft.set(head.secondsLeft);
          this.state.set({ phase: 'question', q: head, options, deadline: Date.now() + head.secondsLeft * 1000 });
          break;
      }
    });
  }

  private tick(): void {
    const s = this.state();
    if (s.phase !== 'question') return;
    const left = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
    this.secondsLeft.set(left);
    if (left === 0 && !this.busy()) {
      // נגמר הזמן: בחירה שסומנה נשלחת (השרת נותן מרווח חסד), אחרת השאלה נסגרת
      const id = this.selectedId();
      void this.submit(() => (id !== null ? this.api.answer(id) : this.api.timeout()));
    }
  }

  private async submit(send: () => Promise<AnswerResult>): Promise<void> {
    const s = this.state();
    if (s.phase !== 'question') return;
    await this.run(async () => {
      const result = await send();
      if (result.status === 'OK') {
        this.state.set({ phase: 'revealed', q: s.q, options: s.options, result });
        void this.voice.play(result.isCorrect ? 'Correct' : 'Incorrect', true);
      }
      else if (result.status === 'TooEarly') return; // שעון הטלפון מקדים, הטיק הבא ינסה שוב
      else await this.load(); // לא מסונכרן עם השרת, טוענים מחדש
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch {
      this.state.set({ phase: 'error' });
    } finally {
      this.busy.set(false);
    }
  }
}
