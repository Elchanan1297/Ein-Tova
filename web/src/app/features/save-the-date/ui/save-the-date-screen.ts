import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { SaveTheDateInfo } from '../../../core/save-the-date/save-the-date-models';
import { dateLines } from '../data/event-date';

/** הגדרות להצגה (בלי serverNow: גם התצוגה המקדימה בניהול משתמשת ברכיב) */
export type SaveTheDateView = Omit<SaveTheDateInfo, 'locked' | 'serverNow'>;

const UNITS = ['ימים', 'שעות', 'דקות', 'שניות'] as const;

/**
 * המסך שמוזמנים רואים בזמן נעילה: לוגו, אבא בקשת, כותרת, תאריך (לועזי / עברי / שניהם), שעון חול וספירה לאחור.
 * העיצוב והאנימציה מהדמו (save-the-date-kit). שעון החול ב־CSS בלבד.
 */
@Component({
  selector: 'app-save-the-date-screen',
  templateUrl: './save-the-date-screen.html',
  styleUrl: './save-the-date-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveTheDateScreen {
  readonly info = input.required<SaveTheDateView>();
  /** הפרש שעון השרת מהמכשיר (מ־serverNow), כדי שהספירה תהיה נכונה גם כשהשעון בטלפון לא */
  readonly clockOffset = input(0);

  private readonly now = signal(Date.now());

  protected readonly lines = computed(() => {
    const i = this.info();
    return dateLines(i.eventAt, i.display, i.afterNightfall, i.hebrewText);
  });

  /** null = בלי ספירה; [] = הזמן הגיע ("היום!") */
  protected readonly countdown = computed(() => {
    const i = this.info();
    const at = i.eventAt ? Date.parse(i.eventAt) : NaN;
    if (!i.showCountdown || isNaN(at)) return null;
    const s = Math.floor(Math.max(0, at - (this.now() + this.clockOffset())) / 1000);
    if (s === 0) return [];
    const values = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
    return values.map((n, k) => ({ value: String(n).padStart(2, '0'), label: UNITS[k] }));
  });

  constructor() {
    // האפליקציה zoneless (אין zone לצאת ממנו): טיימר רגיל שמעדכן Signal, ורק הספירה מתרנדרת מחדש
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
