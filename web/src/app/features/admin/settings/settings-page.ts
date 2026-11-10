import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ConfigStore } from '../../../core/config/config-store';
import { AdminApi, SaveError, Settings } from '../data/admin-api';
import { GameStatsPanel } from './ui/game-stats';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';

/** ערכי הטופס בצורה נוחה לעריכה (מספרים, זמן מקומי, אחוזים) */
interface Form {
  gameMode: Settings['gameMode'];
  opensAt: string;
  closesAt: string;
  questionCount: number;
  factsLabelCount: string;
  secondsPerQuestion: number;
  graceMs: number;
  voicePct: number;
  leaderboardRank: Settings['leaderboardRank'];
}

const FIELD_ERRORS: Partial<Record<keyof Settings, string>> = {
  opensAt: 'זמן הפתיחה לא תקין.',
  closesAt: 'זמן הסגירה חייב להיות אחרי זמן הפתיחה.',
  questionCount: 'מספר השאלות לא תקין.',
  factsLabelCount: 'המספר בכותרת חייב להיות 1 ומעלה, או ריק.',
  secondsPerQuestion: 'זמן לשאלה: בין 5 ל־300 שניות.',
  graceMs: 'מרווח הרשת לא תקין.',
  voiceChance: 'הסתברות הקול לא תקינה.',
};

/** הגדרות המשחק ומצב בזמן אמת. השמירה שולחת רק את מה שהשתנה. */
@Component({
  selector: 'app-settings-page',
  imports: [EyeLoader, GameStatsPanel],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SettingsPage {
  private readonly api = inject(AdminApi);
  private readonly config = inject(ConfigStore);
  private readonly statsPanel = viewChild(GameStatsPanel);

  protected readonly form = signal<Form | null>(null);
  private readonly saved = signal<Form | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly loadFailed = signal(false);

  private readonly changes = computed<Partial<Settings>>(() => {
    const f = this.form();
    const s = this.saved();
    if (!f || !s) return {};
    const now = toSettings(f);
    const before = toSettings(s);
    return Object.fromEntries(
      (Object.keys(now) as (keyof Settings)[]).filter((k) => now[k] !== before[k]).map((k) => [k, now[k]]),
    );
  });
  protected readonly dirty = computed(() => Object.keys(this.changes()).length > 0);

  /** כמה שאלות ישוחקו בפועל לפי מה שבטופס: לא יותר ממה שפעיל */
  protected readonly active = computed(() => this.statsPanel()?.activeQuestions() ?? null);
  protected readonly played = computed(() => {
    const active = this.active();
    const wanted = this.form()?.questionCount ?? 0;
    if (active === null) return null;
    return wanted <= 0 || wanted > active ? active : wanted;
  });

  protected readonly started = computed(() => this.statsPanel()?.started() ?? null);
  protected readonly confirmReset = signal(false);

  constructor() {
    void this.load();
  }

  /** איפוס המשחק לכולם: לחיצה ראשונה מבקשת אישור, שנייה מוחקת */
  protected async resetAll(): Promise<void> {
    if (!this.confirmReset()) {
      this.confirmReset.set(true);
      return;
    }
    this.confirmReset.set(false);
    this.busy.set(true);
    try {
      const res = await this.api.resetAllAttempts();
      this.message.set({ ok: true, text: `המשחק אופס (${res.reset} תוצאות נמחקו). כולם יכולים לשחק שוב.` });
      this.statsPanel()?.reload();
    } catch {
      this.message.set({ ok: false, text: 'האיפוס נכשל. נסו שוב.' });
    } finally {
      this.busy.set(false);
    }
  }

  protected async load(): Promise<void> {
    try {
      const form = toForm(await this.api.settings());
      this.form.set(form);
      this.saved.set(form);
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    }
  }

  protected set<K extends keyof Form>(key: K, value: Form[K]): void {
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
    this.message.set(null);
  }

  protected async save(): Promise<void> {
    await this.send(this.changes(), 'ההגדרות נשמרו.');
  }

  /** פתח/סגור עכשיו: נשמר מיד, בלי לגעת בשאר השינויים בטופס */
  protected async setGameNow(mode: 'Always' | 'Closed'): Promise<void> {
    if (await this.send({ gameMode: mode }, mode === 'Always' ? 'המשחק נפתח.' : 'המשחק נסגר.')) {
      this.form.update((f) => (f ? { ...f, gameMode: mode } : f));
    }
  }

  protected revert(): void {
    this.form.set(this.saved());
    this.message.set(null);
  }

  private async send(changes: Partial<Settings>, okText: string): Promise<boolean> {
    if (!Object.keys(changes).length) return false;
    this.busy.set(true);
    try {
      await this.api.saveSettings(changes);
      const s = this.saved();
      if (s) this.saved.set({ ...s, ...toForm({ ...toSettings(s), ...changes }) });
      this.message.set({ ok: true, text: okText });
      this.statsPanel()?.reload();
      this.config.reload();
      return true;
    } catch (e) {
      const err = e instanceof HttpErrorResponse && e.status === 400 ? (e.error as SaveError) : null;
      const text = (err?.field && FIELD_ERRORS[err.field]) || 'השמירה נכשלה. נסו שוב.';
      this.message.set({ ok: false, text });
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}

function toForm(s: Settings): Form {
  return {
    gameMode: s.gameMode,
    opensAt: toLocalInput(s.opensAt),
    closesAt: toLocalInput(s.closesAt),
    questionCount: Number(s.questionCount) || 0,
    factsLabelCount: s.factsLabelCount ?? '',
    secondsPerQuestion: Number(s.secondsPerQuestion) || 20,
    graceMs: Number(s.graceMs) || 0,
    voicePct: Math.round((Number(s.voiceChance) || 0) * 100),
    leaderboardRank: s.leaderboardRank,
  };
}

function toSettings(f: Form): Settings {
  return {
    gameMode: f.gameMode,
    opensAt: fromLocalInput(f.opensAt),
    closesAt: fromLocalInput(f.closesAt),
    questionCount: String(f.questionCount),
    factsLabelCount: f.factsLabelCount.trim() || null,
    secondsPerQuestion: String(f.secondsPerQuestion),
    graceMs: String(f.graceMs),
    voiceChance: String(f.voicePct / 100),
    leaderboardRank: f.leaderboardRank,
  };
}

/** ISO UTC מה־DB → ערך ל־datetime-local בשעון המקומי */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
