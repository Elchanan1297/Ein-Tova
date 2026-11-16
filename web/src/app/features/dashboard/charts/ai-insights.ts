import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';
import { AI_MESSAGES, AiApi, AiStatus, AiStatusCode, AskResponse, Insight } from './ai-api';

const SUGGESTIONS = ['מי ענה הכי מהר ונכון?', 'אילו שאלות הפתיעו?', 'איזו משפחה הכי מדויקת?', 'מה רוב הטועים בחרו בשאלה הכי קשה?'];
const MAX_PUBLISH = 3;

/**
 * בלוק "תובנות AI" בדשבורד של המנהל (שלב ב׳): כרטיסי תובנה עם ראיות, "שאלו את הנתונים",
 * "סכמו את הערב לברכה", ובחירת עד 3 תובנות להצגה לאורחים ובמסך הגדול.
 * מוסתר כשהמתג כבוי. כשל ב־AI לא משפיע על שאר הדשבורד.
 */
@Component({
  selector: 'app-ai-insights',
  imports: [EyeLoader],
  templateUrl: './ai-insights.html',
  styleUrl: './ai-insights.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiInsights {
  private readonly api = inject(AiApi);

  protected readonly status = signal<AiStatus | null>(null);
  protected readonly insights = signal<Insight[]>([]);
  protected readonly code = signal<AiStatusCode | null>(null);
  protected readonly loading = signal(false);
  protected readonly players = signal(0);
  protected readonly createdAt = signal<string | null>(null);

  protected readonly suggestions = SUGGESTIONS;
  protected readonly question = signal('');
  protected readonly asking = signal(false);
  protected readonly answer = signal<AskResponse | null>(null);

  protected readonly blessing = signal<string | null>(null);
  protected readonly blessingBusy = signal(false);
  protected readonly blessingMsg = signal<string | null>(null);
  protected readonly copied = signal(false);

  /** בחירה לפרסום (לפי id) */
  protected readonly picked = signal<Set<string>>(new Set());
  protected readonly published = signal<Insight[]>([]);
  protected readonly publishing = signal(false);
  protected readonly maxPublish = MAX_PUBLISH;

  protected readonly message = computed(() => {
    const c = this.code();
    return c && c !== 'OK' ? AI_MESSAGES[c] : null;
  });
  protected readonly updated = computed(() => {
    const t = this.createdAt();
    return t ? new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : null;
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      const s = await this.api.status();
      this.status.set(s);
      if (!s.enabled) return;
      void this.loadPublished();
      await this.load(false);
    } catch {
      this.code.set('Unavailable');
    }
  }

  protected async load(refresh: boolean): Promise<void> {
    this.loading.set(true);
    try {
      const r = await this.api.insights(refresh);
      this.code.set(r.status);
      this.players.set(r.players);
      if (r.status === 'OK') {
        this.insights.set(r.insights);
        this.createdAt.set(r.createdAt);
      }
    } catch {
      this.code.set('Unavailable');
    } finally {
      this.loading.set(false);
      void this.refreshStatus();
    }
  }

  protected async ask(text?: string): Promise<void> {
    const q = (text ?? this.question()).trim().slice(0, 300);
    if (!q || this.asking()) return;
    this.question.set(q);
    this.asking.set(true);
    this.answer.set(null);
    try {
      this.answer.set(await this.api.ask(q));
    } catch {
      this.answer.set({ status: 'Unavailable', answer: null, evidence: [] });
    } finally {
      this.asking.set(false);
      void this.refreshStatus();
    }
  }

  protected answerMessage(a: AskResponse): string {
    return a.status === 'OK' ? (a.answer ?? '') : AI_MESSAGES[a.status];
  }

  protected async makeBlessing(): Promise<void> {
    this.blessingBusy.set(true);
    this.blessingMsg.set(null);
    this.copied.set(false);
    try {
      const r = await this.api.blessing();
      if (r.status === 'OK') this.blessing.set(r.text);
      else this.blessingMsg.set(AI_MESSAGES[r.status]);
    } catch {
      this.blessingMsg.set(AI_MESSAGES.Unavailable);
    } finally {
      this.blessingBusy.set(false);
    }
  }

  protected async copy(): Promise<void> {
    const text = this.blessing();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected toggle(id: string): void {
    this.picked.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PUBLISH) next.add(id);
      return next;
    });
  }

  protected async publish(): Promise<void> {
    const chosen = this.insights().filter((i) => this.picked().has(i.id));
    await this.setPublished(chosen);
  }

  protected async unpublish(): Promise<void> {
    await this.setPublished([]);
  }

  private async setPublished(list: Insight[]): Promise<void> {
    this.publishing.set(true);
    try {
      const r = await this.api.publish(list);
      this.published.set(r.insights);
      this.picked.set(new Set());
    } finally {
      this.publishing.set(false);
      void this.refreshStatus();
    }
  }

  private async loadPublished(): Promise<void> {
    try {
      this.published.set((await this.api.published('/api/admin/ai/published')).insights);
    } catch {
      // לא קריטי
    }
  }

  private async refreshStatus(): Promise<void> {
    try {
      this.status.set(await this.api.status());
    } catch {
      // נשארים עם הקודם
    }
  }
}
