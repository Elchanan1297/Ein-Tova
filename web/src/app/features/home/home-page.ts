import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfigStore } from '../../core/config/config-store';
import { Icon, IconName } from '../../shared/ui/icon/icon';

interface Tile {
  path: string;
  label: string;
  icon: IconName;
  tone: 'gold' | 'blue' | 'plain';
}

/** מסך בית: לוגו, ברכת פתיחה ו־4 אריחי זכוכית. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, NgOptimizedImage, Icon],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomePage {
  private readonly factsCount = inject(ConfigStore).factsLabelCount;

  // סדר ברשת RTL: משחק | תוכנית / ברכות | תוצאות
  protected readonly tiles = computed<Tile[]>(() => [
    { path: '/game', label: `משחק ${this.factsCount() ?? ''} עובדות`, icon: 'sparkles', tone: 'plain' },
    { path: '/program', label: 'תוכנית הערב', icon: 'calendar', tone: 'blue' },
    { path: '/greetings', label: 'ברכות', icon: 'play', tone: 'gold' },
    { path: '/leaderboard', label: 'משפחות ולוח תוצאות', icon: 'users', tone: 'plain' },
  ]);
}
