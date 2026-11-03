import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { GameStats } from '../../data/admin-api';

/** מצב המשחק בזמן אמת: כמה התחילו/סיימו, ואחוז הצלחה לכל שאלה. רענון כל 10 שניות. */
@Component({
  selector: 'app-game-stats',
  imports: [DecimalPipe],
  templateUrl: './game-stats.html',
  styleUrl: './game-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameStatsPanel {
  protected readonly stats = httpResource<GameStats>(() => '/api/admin/stats');

  constructor() {
    const document = inject(DOCUMENT);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.stats.reload();
    }, 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  reload(): void {
    this.stats.reload();
  }

  protected pct(correct: number, answered: number): number {
    return answered ? Math.round((correct / answered) * 100) : 0;
  }
}
