import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfigStore } from '../../../core/config/config-store';

/** פתיחה במסך הגדול: אבא, 70 זהב, הלוגו והזמנה לשחק מהטלפון. */
@Component({
  selector: 'app-welcome-scene',
  template: `
    <div class="art rise">
      <span class="seventy" aria-hidden="true">70</span>
      <img src="assets/father-bust.png" alt="אבא" />
    </div>
    <div class="text">
      <p class="kicker rise" style="--d: 0.1s">{{ factsCount() }} עובדות שלא ידעתם על אבא</p>
      <img class="logo sheen rise" style="--d: 0.2s" src="assets/logo/ein-tova-eye-dark.svg" alt="עין טובה" />
      <p class="join rise" style="--d: 0.35s">פותחים בטלפון את הקישור האישי ומשחקים</p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: 4vw;
      height: 100%;
      padding: 0 6vw;
    }
    .text { display: grid; justify-items: center; gap: 3vh; text-align: center; }
    .kicker { margin: 0; font-size: 2.6vh; font-weight: 600; letter-spacing: 0.14em; color: var(--color-gold); }
    .logo { width: min(34vw, 52vh); }
    .join { margin: 0; font-size: 3.2vh; font-weight: 600; color: rgba(248, 243, 234, 0.85); }
    .art { position: relative; display: grid; place-items: end center; height: 82vh; }
    .seventy {
      position: absolute;
      top: 2vh;
      inset-inline: 0;
      text-align: center;
      font: 900 52vh / 0.9 var(--font-display);
      letter-spacing: -0.04em;
      background: linear-gradient(180deg, #f2d698, var(--color-gold) 45%, var(--color-gold-deep));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .art img {
      position: relative;
      height: 70vh;
      -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent);
      mask-image: linear-gradient(180deg, #000 70%, transparent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeScene {
  protected readonly factsCount = inject(ConfigStore).factsLabelCount;
}
