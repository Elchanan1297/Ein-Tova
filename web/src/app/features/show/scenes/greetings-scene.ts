import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { youTubeId } from '../../../shared/util/youtube';
import { AdminGreeting } from '../../admin/data/content-api';

const SLIDE_MS = 9000;

/** ברכות במסך הגדול: מצגת שמתחלפת כל 9 שניות. */
@Component({
  selector: 'app-greetings-scene',
  template: `
    @if (current(); as g) {
      @for (k of [index()]; track k) {
        <article class="slide rise" [class.text-only]="!image()">
          @if (image(); as src) {
            <div class="media"><img [src]="src" alt="" /></div>
          }
          <div class="words">
            @if (g.body) {
              <p class="body">״{{ g.body }}״</p>
            } @else if (g.kind === 'video') {
              <p class="body">ברכה מצולמת</p>
            }
            <p class="from"><strong>{{ g.senderName }}</strong> {{ g.relation }}</p>
          </div>
        </article>
      }
      <div class="dots" aria-hidden="true">
        @for (x of greetings(); track x.greetingId; let i = $index) {
          <span [class.on]="i === index()"></span>
        }
      </div>
    } @else {
      <p class="empty">הברכות יופיעו כאן</p>
    }
  `,
  styles: `
    :host { display: grid; grid-template-rows: 1fr auto; height: 100%; padding: 6vh 6vw 4vh; }
    .slide { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 5vw; min-height: 0; }
    .slide.text-only { grid-template-columns: 1fr; text-align: center; }
    .media { height: 78vh; border-radius: 4vh; overflow: hidden; box-shadow: 0 3vh 6vh rgba(0, 0, 0, 0.45); }
    .media img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
    .words { display: grid; gap: 3vh; }
    .body { margin: 0; font: 700 5vh / 1.45 var(--font-display); color: var(--color-cream); }
    .text-only .body { font-size: 7vh; }
    .from { margin: 0; font-size: 3.4vh; color: rgba(248, 243, 234, 0.75); }
    .from strong { color: var(--color-gold); font-size: 4vh; }
    .dots { display: flex; justify-content: center; gap: 1vh; }
    .dots span { width: 1.2vh; height: 1.2vh; border-radius: 50%; background: rgba(255, 255, 255, 0.2); transition: background 0.4s; }
    .dots .on { background: var(--color-gold); }
    .empty { place-self: center; font-size: 4vh; color: rgba(248, 243, 234, 0.6); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreetingsScene {
  readonly greetings = input.required<AdminGreeting[]>();

  protected readonly index = signal(0);
  protected readonly current = computed(() => {
    const list = this.greetings();
    return list.length ? list[this.index() % list.length] : null;
  });
  protected readonly image = computed(() => {
    const g = this.current();
    if (g?.kind === 'image') return g.mediaUrl;
    const id = g?.kind === 'video' ? youTubeId(g.mediaUrl) : null;
    return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : null;
  });

  constructor() {
    const timer = setInterval(() => {
      const n = this.greetings().length;
      if (n > 1) this.index.update((i) => (i + 1) % n);
    }, SLIDE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
