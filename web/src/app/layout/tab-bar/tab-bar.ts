import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon, IconName } from '../../shared/ui/icon/icon';

interface Tab {
  path: string;
  label: string;
  icon: IconName;
}

// סדר מימין לשמאל: בית · תוצאות · ברכות · תמונות · משחק · תוכנית
const TABS: readonly Tab[] = [
  { path: '/home', label: 'בית', icon: 'home' },
  { path: '/program', label: 'תוכנית', icon: 'calendar' },
  { path: '/greetings', label: 'ברכות', icon: 'play' },
  { path: '/photos', label: 'תמונות', icon: 'image' },
  { path: '/game', label: 'משחק', icon: 'sparkles' },
  { path: '/leaderboard', label: 'תוצאות', icon: 'trophy' },
];

@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, Icon],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabBar {
  protected readonly tabs = TABS;
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activeIndex = computed(() =>
    TABS.findIndex((t) => this.url().startsWith(t.path)),
  );
}
