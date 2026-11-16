import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AiApi, Insight } from './ai-api';

/** התובנות שהמנהל אישר, לאורחים (אחרי סיום המשחק). בלי טקסט חופשי, רק לקריאה */
@Component({
  selector: 'app-ai-published',
  template: `
    @if (insights().length) {
      <section class="pub" aria-labelledby="pub-title">
        <h3 id="pub-title"><span class="spark" aria-hidden="true">✦</span> תובנות מהערב</h3>
        <div class="ins">
          @for (i of insights(); track i.id) {
            <article class="in" [attr.data-sev]="i.severity">
              <div class="ic" aria-hidden="true">{{ i.icon }}</div>
              <b>{{ i.title }}</b>
              <p>{{ i.body }}</p>
              @if (i.evidence.length) {
                <div class="ev">@for (e of i.evidence; track e) { <span>{{ e }}</span> }</div>
              }
            </article>
          }
        </div>
        <small>נוצר באמצעות AI על בסיס התוצאות בלבד.</small>
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .pub { margin-bottom: 16px; padding: 18px; border-radius: 22px; background: linear-gradient(145deg, rgba(169, 152, 240, 0.12), rgba(217, 182, 111, 0.08)); border: 1px solid rgba(169, 152, 240, 0.3); }
    h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font: 700 20px var(--font-display); color: var(--color-cream); }
    .spark { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: linear-gradient(135deg, #d9b66f, #a998f0); color: #1b1630; font-size: 15px; }
    .ins { display: grid; gap: 10px; }
    @container (min-width: 820px) { .ins { grid-template-columns: repeat(3, 1fr); } }
    .in {
      --c: #7fd1b0;
      position: relative;
      padding: 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      overflow: hidden;
      &::before { content: ''; position: absolute; inset-block: 0; inset-inline-start: 0; width: 3px; background: var(--c); }
      &[data-sev='positive'] { --c: #d9b66f; }
      &[data-sev='warning'] { --c: #e58a9b; }
      .ic { font-size: 20px; }
      b { display: block; margin: 4px 0; font-size: 15.5px; }
      p { margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #d5daee; }
    }
    .ev { display: flex; gap: 6px; flex-wrap: wrap; span { font-size: 11px; padding: 3px 8px; border-radius: 99px; background: rgba(255, 255, 255, 0.07); color: #9aa3c4; } }
    small { display: block; margin-top: 10px; font-size: 11.5px; color: #9aa3c4; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPublished {
  /** /api/results/insights (אורחים) */
  readonly url = input('/api/results/insights');
  protected readonly insights = signal<Insight[]>([]);
  private readonly api = inject(AiApi);

  constructor() {
    queueMicrotask(async () => {
      try {
        this.insights.set((await this.api.published(this.url())).insights);
      } catch {
        // אין תובנות מאושרות, או שעוד לא פורסם: לא מציגים כלום
      }
    });
  }
}
