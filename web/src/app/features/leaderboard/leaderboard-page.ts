import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { Icon } from '../../shared/ui/icon/icon';
import { LeaderboardStore } from './leaderboard-store';

/** לוח תוצאות חי לפי משפחות, ומתחתיו השחקנים המובילים. */
@Component({
  selector: 'app-leaderboard-page',
  imports: [DecimalPipe, Icon],
  providers: [LeaderboardStore],
  templateUrl: './leaderboard-page.html',
  styleUrl: './leaderboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LeaderboardPage {
  protected readonly board = inject(LeaderboardStore);
  protected readonly myFamilyId = inject(AuthStore).guest()?.familyId ?? null;
}
