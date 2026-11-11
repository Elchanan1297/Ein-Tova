import { HDate, Locale, gematriya } from '@hebcal/core';
import { SaveTheDateDisplay } from '../../../core/save-the-date/save-the-date-models';

/** האירוע בישראל: כל התצוגה והחישובים לפי השעון הזה, לא לפי המכשיר */
export const EVENT_TZ = 'Asia/Jerusalem';

/** "יום חמישי, 14 בינואר 2027" */
export function gregorianText(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: EVENT_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** "19:00" */
export function timeText(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/**
 * "ו׳ בשבט תשפ״ז", לפי היום בישראל. אירוע בערב (אחרי השקיעה) שייך ליום העברי הבא.
 * שגיאה בחישוב → מחרוזת ריקה (ואז מוצג הלועזי).
 */
export function hebrewText(d: Date, afterNightfall: boolean): string {
  try {
    const p = jerusalemParts(d);
    let hd = new HDate(new Date(p.year, p.month - 1, p.day));
    if (afterNightfall) hd = hd.next();
    const month = Locale.gettext(hd.getMonthName(), 'he-x-NoNikud');
    return `${gematriya(hd.getDate())} ב${month} ${gematriya(hd.getFullYear())}`;
  } catch {
    return '';
  }
}

/** השורה הראשית והמשנית לפי בחירת התצוגה. דריסה ידנית מנצחת את החישוב */
export function dateLines(
  eventAt: string | null,
  display: SaveTheDateDisplay,
  afterNightfall: boolean,
  override: string,
): { main: string; sub: string; time: string } | null {
  const d = eventAt ? new Date(eventAt) : null;
  if (!d || isNaN(d.getTime())) return null;
  const greg = gregorianText(d);
  const heb = override.trim() || hebrewText(d, afterNightfall);
  const time = timeText(d);
  if (display === 'gregorian' || !heb) return { main: greg, sub: '', time };
  if (display === 'hebrew') return { main: heb, sub: '', time };
  return { main: heb, sub: greg, time };
}

/** ISO → ערך ל־datetime-local, בשעון ישראל (גם אם המנהל בחו"ל) */
export function toJerusalemInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = jerusalemParts(d);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

/** ערך datetime-local שנבחר כשעון ישראל → ISO UTC (כולל מעבר שעון קיץ/חורף) */
export function fromJerusalemInput(value: string): string | null {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = wall - offsetMs(new Date(wall));
  t = wall - offsetMs(new Date(t)); // תיקון סביב המעבר
  return new Date(t).toISOString();
}

function offsetMs(d: Date): number {
  const p = jerusalemParts(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

function jerusalemParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}
