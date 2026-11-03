import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MuteButton } from '../mute-button/mute-button';
import { TabBar } from '../tab-bar/tab-bar';

/** מעטפת המסכים הפנימיים: רקע, עמודת תוכן, כפתור השתקה וסרגל טאבים תחתון. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, TabBar, MuteButton],
  template: `
    <app-mute-button />
    <main class="page">
      <router-outlet />
    </main>
    <app-tab-bar />
  `,
  styles: `
    :host { display: block; min-height: 100dvh; overflow-x: clip; background: var(--bg-app); }
    // עמודה בגובה המסך, כך שמסך (כמו המשחק) יכול להתמתח עד סרגל הטאבים
    main {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      padding-block: 24px calc(110px + env(safe-area-inset-bottom));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Shell {}
