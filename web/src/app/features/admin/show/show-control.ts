import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Icon, IconName } from '../../../shared/ui/icon/icon';
import { Scene, ShowApi, ShowState } from '../../show/data/show-api';

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
    return scene === 'winner' ? 'הכרזת זוכה' : (SCENES.find((s) => s.scene === scene)?.label ?? '');
  });
  protected readonly winnerNames = computed(() => {
    const s = this.state();
    return s?.scene === 'winner' && s.winner ? s.winner.families.map((f) => f.name).join(' ו') : null;
  });

  constructor() {
    void this.refresh();
    // אם מישהו אחר (או המקלדת במחשב של המצגת) החליף סצנה
    const timer = setInterval(() => void this.refresh(), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
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

  private async run(action: () => Promise<ShowState>, noScores = 'הפעולה נכשלה.'): Promise<void> {
    this.busy.set(true);
    try {
      this.state.set(await action());
      this.message.set(null);
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.error?.status : null;
      this.message.set({ ok: false, text: status === 'NoScores' ? noScores : 'הפעולה נכשלה.' });
    } finally {
      this.busy.set(false);
    }
  }
}
