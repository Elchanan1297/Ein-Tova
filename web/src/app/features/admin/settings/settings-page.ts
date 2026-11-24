import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { ConfigStore } from '../../../core/config/config-store';
import { AdminApi, SaveError, Settings } from '../data/admin-api';
import { GameStatsPanel } from './ui/game-stats';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

/** ערכי הטופס בצורה נוחה לעריכה (מספרים, זמן מקומי, אחוזים) */
interface Form {
  gameMode: Settings['gameMode'];
  opensAt: string;
  closesAt: string;
  questionCount: number;
  factsLabelCount: string;
  secondsPerQuestion: number;
  ivrExtraSec: number;
  aiEnabled: boolean;
  aiMaxCallsPerHour: number;
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
  ivrExtraSec: 'זמן נוסף בטלפון: בין 0 ל־300 שניות.',
  aiMaxCallsPerHour: 'מספר הקריאות בשעה: בין 1 ל־1000.',
  graceMs: 'מרווח הרשת לא תקין.',
  voiceChance: 'הסתברות הקול לא תקינה.',
};

type Tab = 'game' | 'questions' | 'voices' | 'ai' | 'maintenance';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'game', label: 'זמינות המשחק', icon: 'play' },
  { id: 'questions', label: 'הגדרות שאלות', icon: 'question' },
  { id: 'voices', label: 'קולות ולוח תוצאות', icon: 'volume' },
  { id: 'ai', label: 'תובנות AI', icon: 'sparkles' },
  { id: 'maintenance', label: 'תחזוקה', icon: 'trash' },
];

/** באיזה טאב נמצא כל שדה (לשגיאת שמירה ולסימון שינויים שלא נשמרו) */
const FIELD_TAB: Record<keyof Settings, Tab> = {
  gameMode: 'game',
  opensAt: 'game',
  closesAt: 'game',
  questionCount: 'questions',
  factsLabelCount: 'questions',
  secondsPerQuestion: 'questions',
  ivrExtraSec: 'questions',
  voiceChance: 'voices',
  leaderboardRank: 'voices',
  graceMs: 'voices',
  aiEnabled: 'ai',
  aiMaxCallsPerHour: 'ai',
};

/** שם השדה בטופס לפי שם ההגדרה (לחיבור שגיאה לשדה) */
const FORM_TO_SETTING: Partial<Record<keyof Form, keyof Settings>> = { voicePct: 'voiceChance' };

/**
 * הגדרות המשחק ומצב בזמן אמת, בחמישה טאבים עם טיוטה אחת: מעבר בין טאבים לא שומר ולא מאפס.
 * השמירה שולחת רק את מה שהשתנה בכל הטופס. כל הלוחות נשארים טעונים (מוסתרים), כך שנתוני המשחק החיים
 * ממשיכים להתעדכן גם כשנמצאים בטאב אחר.
 */
@Component({
  selector: 'app-settings-page',
  imports: [EyeLoader, GameStatsPanel, Icon],
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

  // ===== טאבים =====
  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('game');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  /** "מתקדם" בטאב הקולות (נפתח לבד כשיש שגיאה במרווח הרשת) */
  protected readonly advancedOpen = signal(false);
  /** השדה שנכשל בשמירה (מסומן בטאב ובשדה עד שעורכים אותו) */
  protected readonly errorField = signal<keyof Settings | null>(null);
  protected readonly errorText = computed(() => {
    const f = this.errorField();
    return f ? (FIELD_ERRORS[f] ?? null) : null;
  });
  protected readonly errorTab = computed(() => {
    const f = this.errorField();
    return f ? FIELD_TAB[f] : null;
  });
  /** טאבים עם שינויים שלא נשמרו */
  protected readonly dirtyTabs = computed(() => new Set((Object.keys(this.changes()) as (keyof Settings)[]).map((k) => FIELD_TAB[k])));
  protected readonly dirtyLabels = computed(() =>
    TABS.filter((t) => this.dirtyTabs().has(t.id)).map((t) => t.label).join(', '),
  );

  protected selectTab(t: Tab): void {
    // יציאה מ"תחזוקה" מבטלת אישור איפוס שהתחיל, כדי שלא יישאר "דרוך"
    if (this.tab() === 'maintenance' && t !== 'maintenance') this.confirmReset.set(false);
    this.tab.set(t);
  }

  /** חיצים לפי הסדר החזותי מימין לשמאל: שמאלה = הטאב הבא */
  protected tabKey(e: KeyboardEvent, index: number): void {
    const n = TABS.length;
    let next: number;
    switch (e.key) {
      case 'ArrowLeft':
        next = (index + 1) % n;
        break;
      case 'ArrowRight':
        next = (index - 1 + n) % n;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.selectTab(TABS[next].id);
    const btn = this.tabButtons()[next]?.nativeElement;
    btn?.focus();
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  protected isErr(field: keyof Settings): boolean {
    return this.errorField() === field;
  }

  /** שגיאה בשדה מטאב אחר: עוברים לטאב, פותחים את "מתקדם" אם צריך, וממקדים את השדה */
  private revealField(field: keyof Settings): void {
    const tab = FIELD_TAB[field];
    this.selectTab(tab);
    if (field === 'graceMs') this.advancedOpen.set(true);
    setTimeout(() => {
      // בטלפון פס הטאבים נגלל לרוחב: קודם מביאים את הטאב עם ה־⚠ לתצוגה (לרוחב בלבד, מיידי),
      // ואחר כך גוללים את הדף אל השדה
      const btn = this.tabButtons()[TABS.findIndex((t) => t.id === tab)]?.nativeElement;
      const strip = btn?.parentElement;
      if (btn && strip) {
        const b = btn.getBoundingClientRect();
        const s = strip.getBoundingClientRect();
        if (b.left < s.left) strip.scrollLeft -= s.left - b.left + 16;
        else if (b.right > s.right) strip.scrollLeft += b.right - s.right + 16;
      }
      // לגובה: פס הטאבים דביק, אז הוא נשאר גלוי. השדה עצמו במרכז המסך
      const el = document.getElementById(`set-${field}`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
    });
  }

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
    if (this.errorField() === (FORM_TO_SETTING[key] ?? key)) this.errorField.set(null);
  }

  /** בחירת מצב משחק. "לפי חלון זמן" פותח אזור חדש מתחת לאריחים: מביאים אותו לתצוגה כדי שיראו שנפתח */
  protected setMode(mode: Form['gameMode']): void {
    const opening = mode === 'Window' && this.form()?.gameMode !== 'Window';
    this.set('gameMode', mode);
    if (!opening) return;
    // אחרי שהאנימציה נגמרה (הגובה הסופי ידוע): אם האזור מוסתר מתחת לפס השמירה או לתחתית המסך,
    // גוללים בדיוק כדי שייראה במלואו מעל הפס
    setTimeout(() => {
      const el = document.getElementById('window-tile');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const bar = document.querySelector<HTMLElement>('.savebar');
      const limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 16;
      if (r.bottom > limit) window.scrollBy({ top: Math.min(r.bottom - limit, r.top - stickyTop()), behavior: 'smooth' });
    }, 480);
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
    this.errorField.set(null);
  }

  private async send(changes: Partial<Settings>, okText: string): Promise<boolean> {
    if (!Object.keys(changes).length) return false;
    this.busy.set(true);
    try {
      await this.api.saveSettings(changes);
      this.errorField.set(null);
      const s = this.saved();
      if (s) this.saved.set({ ...s, ...toForm({ ...toSettings(s), ...changes }) });
      this.message.set({ ok: true, text: okText });
      this.statsPanel()?.reload();
      this.config.reload();
      return true;
    } catch (e) {
      const err = e instanceof HttpErrorResponse && e.status === 400 ? (e.error as SaveError) : null;
      const field = err?.field && err.field in FIELD_TAB ? err.field : null;
      const text = (field && FIELD_ERRORS[field]) || 'השמירה נכשלה. נסו שוב.';
      this.message.set({ ok: false, text });
      this.errorField.set(field);
      if (field) this.revealField(field);
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
    ivrExtraSec: s.ivrExtraSec == null ? 30 : Number(s.ivrExtraSec) || 0,
    aiEnabled: s.aiEnabled === '1',
    aiMaxCallsPerHour: Number(s.aiMaxCallsPerHour) || 20,
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
    ivrExtraSec: String(f.ivrExtraSec),
    aiEnabled: f.aiEnabled ? '1' : '0',
    aiMaxCallsPerHour: String(f.aiMaxCallsPerHour),
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


/** התחתית של פס הטאבים הדביק: גלילה לא תסתיר תחתיו את ראש האזור */
function stickyTop(): number {
  const tabs = document.querySelector<HTMLElement>('app-settings-page .tabs, .tabs');
  return (tabs?.getBoundingClientRect().bottom ?? 0) + 12;
}
