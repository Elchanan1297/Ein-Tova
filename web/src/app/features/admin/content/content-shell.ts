import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** תוכן: ברכות · תוכנית הערב · קולות של אבא */
@Component({
  selector: 'app-content-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <h1>תוכן</h1>
    <nav class="tabs" aria-label="סוג תוכן">
      <a routerLink="greetings" routerLinkActive="active">ברכות</a>
      <a routerLink="program" routerLinkActive="active">תוכנית הערב</a>
      <a routerLink="voices" routerLinkActive="active">קולות של אבא</a>
    </nav>
    <router-outlet />
  `,
  styles: `
    :host { display: grid; gap: 14px; }
    h1 { font-size: 28px; }
    .tabs {
      display: flex;
      gap: 4px;
      justify-self: start;
      padding: 4px;
      border-radius: var(--radius-pill);
      background: rgba(0, 0, 0, 0.2);
    }
    a {
      padding: 8px 16px;
      border-radius: var(--radius-pill);
      color: rgba(248, 243, 234, 0.75);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      &.active { background: rgba(217, 182, 111, 0.28); color: var(--color-gold); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ContentShell {}
