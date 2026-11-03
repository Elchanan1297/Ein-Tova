import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Icon } from '../../../shared/ui/icon/icon';
import { youTubeId } from '../../../shared/util/youtube';
import { Greeting } from '../data/greeting-models';

/** ברכה אחת: תמונה, סרטון (נטען רק בלחיצה) או טקסט, ומתחת שם השולח. */
@Component({
  selector: 'app-greeting-card',
  imports: [Icon],
  templateUrl: './greeting-card.html',
  styleUrl: './greeting-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreetingCard {
  private readonly sanitizer = inject(DomSanitizer);

  readonly greeting = input.required<Greeting>();

  protected readonly playing = signal(false);
  /** תמונות שהועלו בניהול נשמרות בשני גדלים: הטלפון מוריד רק את הקטן */
  protected readonly srcset = computed(() => {
    const url = this.greeting().mediaUrl;
    return url?.endsWith('-1280.webp') ? `${url.replace(/-1280\.webp$/, '-640.webp')} 640w, ${url} 1280w` : null;
  });
  private readonly videoId = computed(() =>
    this.greeting().kind === 'video' ? youTubeId(this.greeting().mediaUrl) : null,
  );
  protected readonly thumb = computed(() => {
    const id = this.videoId();
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  });
  // youtube-nocookie: בלי עוגיות מעקב עד שמנגנים
  protected readonly embedUrl = computed(() => {
    const id = this.videoId();
    return id
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
        )
      : null;
  });
}
