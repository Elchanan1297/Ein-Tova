import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfigStore } from '../../core/config/config-store';
import { Icon } from '../../shared/ui/icon/icon';
import { GameStore } from './game-store';
import { GameSummary } from './ui/game-summary';
import { QuestionView } from './ui/question-view';
import { EyeLoader } from '../../shared/ui/eye-loader/eye-loader';

/** משחק 70 עובדות: פתיחה → שאלות → סיכום. ה־store חי כל עוד הדף פתוח. */
@Component({
  selector: 'app-game-page',
  imports: [EyeLoader, RouterLink, Icon, QuestionView, GameSummary],
  providers: [GameStore],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class GamePage {
  protected readonly game = inject(GameStore);
  protected readonly config = inject(ConfigStore).config;
}
