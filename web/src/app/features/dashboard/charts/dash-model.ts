import { DashboardFamily, DashboardPlayer } from '../data/dashboard-models';
import { ChartsFamily } from './dash-store';

/** חישובי תצוגה משותפים לדשבורד (מנהל ואורחים) ולמסך הגדול. בלי חלוקה באפס */

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

export interface RaceRow extends DashboardFamily {
  width: number;
  color: string;
}

/** מרוץ המשפחות: רוחב הפס יחסית למובילה. onlyPlayed: רק משפחות ששיחקו (לאורחים ולמסך) */
export function raceRows(families: DashboardFamily[], colors: Map<number, string>, onlyPlayed = false): RaceRow[] {
  const fams = onlyPlayed ? families.filter((f) => f.players > 0) : families;
  const max = Math.max(1, ...fams.map((f) => f.displayScore));
  return fams.map((f) => ({ ...f, width: (100 * f.displayScore) / max, color: colors.get(f.familyId) ?? '#D9B66F' }));
}

export interface PodiumSpot {
  p: DashboardPlayer;
  place: 1 | 2 | 3;
}

/** שלושת המובילים בסדר של פודיום: שני, ראשון, שלישי */
export function podiumOf(players: DashboardPlayer[]): PodiumSpot[] {
  const top = players.filter((p) => p.rnk !== null).sort((a, b) => a.rnk! - b.rnk!).slice(0, 3);
  const spots: (PodiumSpot | null)[] = [
    top[1] ? { p: top[1], place: 2 } : null,
    top[0] ? { p: top[0], place: 1 } : null,
    top[2] ? { p: top[2], place: 3 } : null,
  ];
  return spots.filter((s): s is PodiumSpot => s !== null);
}

export interface Award {
  icon: string;
  title: string;
  f: DashboardFamily | null;
  value: string;
  note: string;
  color: string;
}

/** מי מצטיין במה: הכי מדויקת, הכי מהירה, הכי משתתפת, רצף הכי ארוך */
export function awardsOf(families: DashboardFamily[], extra: Map<number, ChartsFamily>, colors: Map<number, string>): Award[] {
  const pick = <T>(list: T[], key: (t: T) => number, dir: 1 | -1) =>
    list.reduce<T | null>((best, t) => (best === null || dir * key(t) > dir * key(best) ? t : best), null);
  const played = families.filter((f) => f.answered > 0);
  const accurate = pick(played, (f) => f.correctPct, 1);
  const fastest = pick(played.filter((f) => f.avgSec !== null), (f) => f.avgSec!, -1);
  const active = pick(families.filter((f) => f.guests > 0 && f.players > 0), (f) => f.players / f.guests, 1);
  const streak = pick(families.filter((f) => (extra.get(f.familyId)?.maxStreak ?? 0) > 0), (f) => extra.get(f.familyId)!.maxStreak, 1);
  return [
    { icon: '🎯', title: 'הכי מדויקת', f: accurate, value: accurate ? `${Math.round(accurate.correctPct)}%` : '', note: 'תשובות נכונות' },
    { icon: '⚡', title: 'הכי מהירה', f: fastest, value: fastest ? `${fastest.avgSec} שנ׳` : '', note: 'זמן ממוצע לתשובה' },
    { icon: '🙌', title: 'הכי משתתפת', f: active, value: active ? `${pct(active.players, active.guests)}%` : '', note: 'מהמשפחה שיחקו' },
    { icon: '🔥', title: 'רצף הכי ארוך', f: streak, value: streak ? String(extra.get(streak.familyId)!.maxStreak) : '', note: 'תשובות נכונות ברצף' },
  ].map((a) => ({ ...a, color: a.f ? (colors.get(a.f.familyId) ?? '#D9B66F') : '#9AA3C4' }));
}
