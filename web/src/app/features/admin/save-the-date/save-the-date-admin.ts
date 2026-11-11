import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LockStore } from '../../../core/save-the-date/lock-store';
import { SaveTheDateDisplay } from '../../../core/save-the-date/save-the-date-models';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';
import { fromJerusalemInput, gregorianText, hebrewText, timeText, toJerusalemInput } from '../../save-the-date/data/event-date';
import { SaveTheDateView } from '../../save-the-date/ui/save-the-date-screen';
import { SaveTheDateApi, SaveTheDateError, SaveTheDateRequest, SaveTheDateSettings } from '../data/save-the-date-api';

/** ערכי הטופס. תאריכים כ־datetime-local בשעון ישראל */
interface Form {
  eventAt: string;
  display: SaveTheDateDisplay;
  afterNightfall: boolean;
  hebrewText: string;
  headline: string;
  subline: string;
  location: string;
  showCountdown: boolean;
  autoOpen: boolean;
  autoOpenAt: string;
}

const FIELD_ERRORS: Partial<Record<keyof SaveTheDateRequest, string>> = {
  eventAt: 'צריך תאריך ושעה תקינים לאירוע (ולשמור אותם) לפני הנעילה.',
  autoOpenAt: 'זמן הפתיחה האוטומטית לא תקין.',
  display: 'בחירת התצוגה לא תקינה.',
  hebrewText: 'התאריך העברי ארוך מדי (עד 120 תווים).',
  headline: 'הכותרת ארוכה מדי (עד 120 תווים).',
  subline: 'השורה העליונה ארוכה מדי (עד 120 תווים).',
  location: 'המקום ארוך מדי (עד 120 תווים).',
};

export const DISPLAYS: [SaveTheDateDisplay, string][] = [
  ['gregorian', 'לועזי'],
  ['hebrew', 'עברי'],
  ['both', 'שניהם'],
];

/** ניהול מצב Save the date: מתג נעילה (עם אישור), תאריך, נוסח, ספירה, פתיחה אוטומטית ותצוגה מקדימה */
@Component({
  selector: 'app-save-the-date-admin',
  imports: [EyeLoader],
  templateUrl: './save-the-date-admin.html',
  styleUrl: './save-the-date-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SaveTheDateAdmin {
  private readonly api = inject(SaveTheDateApi);
  private readonly lock = inject(LockStore);
  private readonly router = inject(Router);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('confirm');

  protected readonly displays = DISPLAYS;
  protected readonly settings = signal<SaveTheDateSettings | null>(null);
  protected readonly form = signal<Form | null>(null);
  private readonly saved = signal<Form | null>(null);
  protected readonly busy = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly dirty = computed(() => JSON.stringify(this.form()) !== JSON.stringify(this.saved()));

  /** שני התאריכים בזמן אמת, בדיוק כמו שייכתבו */
  protected readonly dates = computed(() => {
    const f = this.form();
    const iso = f ? fromJerusalemInput(f.eventAt) : null;
    if (!f || !iso) return null;
    const d = new Date(iso);
    return { gregorian: gregorianText(d), hebrew: hebrewText(d, f.afterNightfall), time: timeText(d) };
  });

  /** נעול / פתוח בפועל, ולמה */
  protected readonly status = computed(() => {
    const s = this.settings();
    if (!s) return null;
    if (s.locked) return { locked: true, text: 'נעול' };
    if (s.enabled) return { locked: false, text: 'פתוח (נפתח אוטומטית)' };
    return { locked: false, text: 'פתוח' };
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.apply(await this.api.get());
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    }
  }

  protected set<K extends keyof Form>(key: K, value: Form[K]): void {
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
    this.message.set(null);
  }

  protected revert(): void {
    this.form.set(this.saved());
    this.message.set(null);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    const s = this.settings();
    if (!f || !s) return;
    await this.send(toRequest(f, s.enabled), 'נשמר.', false);
  }

  /** המתג הראשי: קודם דיאלוג אישור */
  protected askToggle(): void {
    this.message.set(null);
    this.dialog()?.nativeElement.showModal();
  }

  /** מדליק/מכבה עם הערכים השמורים (לא עם שינויים שעוד לא נשמרו) */
  protected async confirmToggle(): Promise<void> {
    this.dialog()?.nativeElement.close();
    const saved = this.saved();
    const s = this.settings();
    if (!saved || !s) return;
    const on = !s.enabled;
    await this.send(toRequest(saved, on), on ? 'האפליקציה נעולה. רק מנהלים נכנסים.' : 'האפליקציה פתוחה לכולם.', true);
  }

  protected cancelToggle(): void {
    this.dialog()?.nativeElement.close();
  }

  protected preview(): void {
    const f = this.form();
    if (!f) return;
    this.api.draft.set(toView(f));
    void this.router.navigateByUrl('/admin/save-the-date/preview');
  }

  /** keepEdits: המתג בלבד לא מוחק עריכה שעוד לא נשמרה */
  private async send(req: SaveTheDateRequest, okText: string, keepEdits: boolean): Promise<boolean> {
    this.busy.set(true);
    const pending = keepEdits && this.dirty() ? this.form() : null;
    try {
      this.apply(await this.api.save(req));
      if (pending) this.form.set(pending);
      this.message.set({ ok: true, text: okText });
      void this.lock.refresh();
      return true;
    } catch (e) {
      const err = e instanceof HttpErrorResponse && e.status === 400 ? (e.error as SaveTheDateError) : null;
      const text = (err?.field && FIELD_ERRORS[err.field]) || 'השמירה נכשלה. נסו שוב.';
      this.message.set({ ok: false, text });
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private apply(s: SaveTheDateSettings): void {
    const form = toForm(s);
    this.settings.set(s);
    this.form.set(form);
    this.saved.set(form);
  }
}

function toForm(s: SaveTheDateSettings): Form {
  return {
    eventAt: toJerusalemInput(s.eventAt),
    display: s.display,
    afterNightfall: s.afterNightfall,
    hebrewText: s.hebrewText ?? '',
    headline: s.headline || 'Save the date',
    subline: s.subline ?? '',
    location: s.location ?? '',
    showCountdown: s.showCountdown,
    autoOpen: !!s.autoOpenAt,
    autoOpenAt: toJerusalemInput(s.autoOpenAt),
  };
}

function toRequest(f: Form, enabled: boolean): SaveTheDateRequest {
  return {
    enabled,
    eventAt: fromJerusalemInput(f.eventAt),
    display: f.display,
    hebrewText: f.hebrewText.trim() || null,
    afterNightfall: f.afterNightfall,
    headline: f.headline.trim() || 'Save the date',
    subline: f.subline.trim() || null,
    location: f.location.trim() || null,
    showCountdown: f.showCountdown,
    autoOpenAt: f.autoOpen ? fromJerusalemInput(f.autoOpenAt) : null,
  };
}

function toView(f: Form): SaveTheDateView {
  return {
    eventAt: fromJerusalemInput(f.eventAt),
    display: f.display,
    hebrewText: f.hebrewText.trim(),
    afterNightfall: f.afterNightfall,
    headline: f.headline.trim() || 'Save the date',
    subline: f.subline.trim(),
    location: f.location.trim(),
    showCountdown: f.showCountdown,
  };
}
