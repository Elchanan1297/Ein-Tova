import { ChangeDetectionStrategy, Component, DOCUMENT, effect, inject, signal } from '@angular/core';
import { VoicePlayer } from '../../core/audio/voice-player';
import { ShowApi } from './data/show-api';
import { GreetingsScene } from './scenes/greetings-scene';
import { LeaderboardScene } from './scenes/leaderboard-scene';
import { QuizScene } from './scenes/quiz-scene';
import { WelcomeScene } from './scenes/welcome-scene';
import { WinnerScene } from './scenes/winner-scene';
import { ShowStore } from './show-store';

/**
 * מסך המצגת (מחשב מחובר למקרן/טלוויזיה). מה שמוצג נשלט מהניהול, או מהמקלדת:
 * 1 פתיחה · 2 לוח תוצאות · 3 ברכות · 4 חידון · W הכרזת זוכה · F מסך מלא
 * בחידון: ← השאלה הבאה · → הקודמת · Enter חשיפת התשובה · A אוטומטי
 */
@Component({
  selector: 'app-show-page',
  imports: [WelcomeScene, LeaderboardScene, GreetingsScene, WinnerScene, QuizScene],
  providers: [ShowStore],
  templateUrl: './show-page.html',
  styleUrl: './show-page.scss',
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShowPage {
  protected readonly show = inject(ShowStore);
  private readonly api = inject(ShowApi);
  private readonly voice = inject(VoicePlayer);
  private readonly document = inject(DOCUMENT);

  protected readonly started = signal(false);
  protected readonly error = signal<string | null>(null);
  private lastWinner: string | null = null;

  constructor() {
    // בכל הכרזה חדשה: הקול של אבא (אם יש קליפ), עם תמלול
    effect(() => {
      const s = this.show.state();
      if (!this.started() || s?.scene !== 'winner' || s.changedAt === this.lastWinner) return;
      this.lastWinner = s.changedAt;
      const clip = this.show.randomWinnerClip();
      if (clip) setTimeout(() => void this.voice.playClip(clip.fileUrl, clip.transcript), 1200);
    });
  }

  private inQuiz(): boolean {
    return this.show.scene() === 'quiz';
  }

  /** לחיצה אחת בתחילת הערב: מסך מלא ושחרור האודיו */
  protected start(): void {
    this.voice.unlock();
    this.lastWinner = this.show.state()?.changedAt ?? null; // לא לנגן הכרזה ישנה
    this.started.set(true);
    void this.document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  protected async onKey(e: KeyboardEvent): Promise<void> {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    try {
      switch (e.code) {
        case 'Digit1': await this.api.setScene('welcome'); break;
        case 'Digit2': await this.api.setScene('leaderboard'); break;
        case 'Digit3': await this.api.setScene('greetings'); break;
        case 'Digit4': await this.api.setScene('quiz'); break;
        // RTL: שמאלה = קדימה
        case 'ArrowLeft': if (this.inQuiz()) await this.api.quiz('next'); else return; break;
        case 'ArrowRight': if (this.inQuiz()) await this.api.quiz('prev'); else return; break;
        case 'Enter': if (this.inQuiz()) await this.api.quiz('reveal'); else return; break;
        case 'KeyA': if (this.inQuiz()) await this.api.quizAuto(!this.show.state()?.quiz?.auto); else return; break;
        case 'KeyW': await this.api.announceWinner(); break;
        case 'KeyF':
          if (this.document.fullscreenElement) await this.document.exitFullscreen();
          else await this.document.documentElement.requestFullscreen();
          break;
        default: return;
      }
      this.error.set(null);
    } catch {
      this.error.set(e.code === 'KeyW' ? 'עוד אין משפחה שסיימה את המשחק.' : e.code === 'Digit4' ? 'אין שאלות פעילות.' : 'הפעולה נכשלה.');
      setTimeout(() => this.error.set(null), 3000);
    }
  }
}
