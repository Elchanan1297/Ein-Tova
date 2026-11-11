import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Icon, IconName } from '../../../shared/ui/icon/icon';
import { Scene, ShowApi, ShowState } from '../../show/data/show-api';

const PHASES = { question: 'השאלה על המסך', reveal: 'התשובה נחשפה', done: 'החידון הסתיים' } as const;

const SCENES: { scene: Exclude<Scene, 'winner'>; label: string; icon: IconName }[] = [
  { scene: 'welcome', label: 'פתיחה', icon: 'home' },
  { scene: 'leaderboard', label: 'לוח תוצאות', icon: 'trophy' },
  { scene: 'greetings', label: 'ברכות', icon: 'play' },
];

/** שלט למצגת: מה מוצג עכשיו במסך הגדול, והכרזת זוכה. עובד גם מהטלפון. */
@Component({
  selector: 'app-show-control',
  imports: [Icon],
  templateUrl: './show-control.html',
  styleUrl: './show-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShowControl {
  private readonly api = inject(ShowApi);

  protected readonly scenes = SCENES;
  protected readonly state = signal<ShowState | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmWinner = signal(false);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly currentLabel = computed(() => {
    const scene = this.state()?.scene;
    if (scene === 'quiz') return 'חידון';
    return scene === 'winner' ? 'הכרזת זוכה' : (SCENES.find((s) => s.scene === scene)?.label ?? '');
  });
  protected readonly winnerNames = computed(() => {
    const s = this.state();
    return s?.scene === 'winner' && s.winner ? s.winner.families.map((f) => f.name).join(' ו') : null;
  });

  protected readonly quiz = computed(() => this.state()?.quiz ?? null);
  protected readonly quizOnScreen = computed(() => this.state()?.scene === 'quiz');
  protected readonly phaseLabel = computed(() => {
    const q = this.quiz();
    return q ? PHASES[q.phase] : '';
  });
  /** אחרי החשיפה: התשובה הנכונה, כדי שהמנחה יוכל לדבר עליה */
  protected readonly correctAnswer = computed(() => this.quiz()?.question?.options.find((o) => o.correct)?.body ?? null);

  constructor() {
    void this.refresh();
    // אם מישהו אחר (או המקלדת במחשב של המצגת, או הטיימר בחידון) שינה משהו
    const timer = setInterval(() => void this.refresh(), 2000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** חידון: start = מההתחלה, show = להציג (ממשיך מאיפה שעצרנו) */
  protected async quizAction(action: 'start' | 'next' | 'prev' | 'reveal' | 'show'): Promise<void> {
    await this.run(
      () => (action === 'show' ? this.api.setScene('quiz') : this.api.quiz(action)),
      'הפעולה נכשלה.',
      'אין שאלות פעילות. מוסיפים בניהול, "שאלות".',
    );
  }

  protected async toggleAuto(): Promise<void> {
    await this.run(() => this.api.quizAuto(!this.quiz()?.auto));
  }

  protected async setScene(scene: Exclude<Scene, 'winner'>): Promise<void> {
    await this.run(() => this.api.setScene(scene));
  }

  protected async announce(): Promise<void> {
    if (!this.confirmWinner()) {
      this.confirmWinner.set(true);
      return;
    }
    this.confirmWinner.set(false);
    await this.run(() => this.api.announceWinner(), 'אין עדיין משפחה שסיימה את המשחק.');
  }

  private async refresh(): Promise<void> {
    try {
      this.state.set(await this.api.state());
    } catch {
      // ננסה שוב בעוד רגע
    }
  }

  private async run(action: () => Promise<ShowState>, noScores = 'הפעולה נכשלה.', noQuestions = 'הפעולה נכשלה.'): Promise<void> {
    this.busy.set(true);
    try {
      this.state.set(await action());
      this.message.set(null);
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.error?.status : null;
      const text = status === 'NoScores' ? noScores : status === 'NoQuestions' ? noQuestions : 'הפעולה נכשלה.';
      this.message.set({ ok: false, text });
    } finally {
      this.busy.set(false);
    }
  }
}
