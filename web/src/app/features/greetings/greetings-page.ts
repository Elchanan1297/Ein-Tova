import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, effect, signal, viewChildren } from '@angular/core';
import { Greeting } from './data/greeting-models';
import { GreetingCard } from './ui/greeting-card';

/** ברכות: פיד אנכי, וצ׳יפים למעלה לקפיצה בין ברכות. הצ׳יפ של הברכה שעל המסך מודגש. */
@Component({
  selector: 'app-greetings-page',
  imports: [GreetingCard],
  templateUrl: './greetings-page.html',
  styleUrl: './greetings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class GreetingsPage {
  protected readonly greetings = httpResource<Greeting[]>(() => '/api/greetings', { defaultValue: [] });
  protected readonly activeId = signal<number | null>(null);

  private readonly cards = viewChildren(GreetingCard, { read: ElementRef<HTMLElement> });
  private readonly chips = viewChildren<ElementRef<HTMLElement>>('chip');
  /** אחרי לחיצה על צ׳יפ לא מעדכנים לפי גלילה עד שהגלילה נגמרת (הברכה האחרונה לא מגיעה לאמצע) */
  private ignoreScrollUntil = 0;

  constructor() {
    // מעקב אחרי הכרטיס שנמצא באמצע המסך
    effect((onCleanup) => {
      const cards = this.cards();
      if (!cards.length) return;
      const io = new IntersectionObserver(
        (entries) => {
          const hit = entries.find((e) => e.isIntersecting);
          if (hit && Date.now() > this.ignoreScrollUntil) this.activeId.set(Number((hit.target as HTMLElement).dataset['id']));
        },
        { rootMargin: '-45% 0px -45% 0px' },
      );
      cards.forEach((c) => io.observe(c.nativeElement));
      onCleanup(() => io.disconnect());
    });

    // הצ׳יפ הפעיל תמיד גלוי בפס הגלילה
    effect(() => {
      const id = this.activeId();
      this.chips()
        .find((c) => Number(c.nativeElement.dataset['id']) === id)
        ?.nativeElement.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
  }

  protected jumpTo(id: number): void {
    this.activeId.set(id);
    this.ignoreScrollUntil = Date.now() + 1000;
    document.getElementById(`greeting-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
