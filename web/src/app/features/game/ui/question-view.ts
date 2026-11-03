import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { GameState } from '../game-store';
import { TimerRing } from './timer-ring';

type QuestionState = Extract<GameState, { phase: 'question' | 'revealed' }>;

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

/** שאלה: התקדמות, כרטיס שאלה וטיימר, תשובות, ואחרי מענה תוצאה ועובדה. */
@Component({
  selector: 'app-question-view',
  imports: [Icon, TimerRing],
  templateUrl: './question-view.html',
  styleUrl: './question-view.scss',
  host: { '[class.revealed]': 'result() !== null' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionView {
  readonly state = input.required<QuestionState>();
  readonly selectedId = input.required<number | null>();
  readonly secondsLeft = input.required<number>();
  readonly progress = input.required<number>();
  readonly busy = input.required<boolean>();

  readonly select = output<number>();
  readonly continue = output<void>();

  protected readonly letters = LETTERS;
  protected readonly result = computed(() => {
    const s = this.state();
    return s.phase === 'revealed' ? s.result : null;
  });

  protected readonly canContinue = computed(
    () => !this.busy() && (this.result() !== null || this.selectedId() !== null),
  );

  protected optionState(optionId: number): 'correct' | 'wrong' | 'selected' | 'idle' {
    const r = this.result();
    if (r) {
      if (optionId === r.correctOptionId) return 'correct';
      return optionId === this.selectedId() ? 'wrong' : 'idle';
    }
    return optionId === this.selectedId() ? 'selected' : 'idle';
  }
}
