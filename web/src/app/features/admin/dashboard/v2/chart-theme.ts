/**
 * ערכת הנושא של הגרפים (ein-tova-theme): צבעים, טקסט, גריד וטולטיפ זכוכית כהה עם מסגרת זהב.
 * צבע לכל משפחה קבוע: לפי הסדר של FamilyId, כך שאותה משפחה באותו צבע בכל הגרפים.
 */
export const PALETTE = ['#D9B66F', '#7FA2E8', '#E58A9B', '#7FD1B0', '#A998F0', '#F0A66B'] as const;
export const TEXT = '#B8C0DE';
export const TEXT_STRONG = '#E6E9F5';
export const GRID = 'rgba(255,255,255,.07)';
export const FONT = 'Assistant';
export const MINT = '#7FD1B0';
export const ROSE = '#E58A9B';

/** צבע קבוע למשפחה: מקום ה־FamilyId ברשימה הממוינת של כל המשפחות */
export function familyColors(familyIds: number[]): Map<number, string> {
  const sorted = [...new Set(familyIds)].sort((a, b) => a - b);
  return new Map(sorted.map((id, i) => [id, PALETTE[i % PALETTE.length]]));
}

export const TOOLTIP = {
  backgroundColor: 'rgba(20,23,42,.94)',
  borderColor: 'rgba(217,182,111,.4)',
  textStyle: { color: '#F8F3EA', fontFamily: FONT },
  extraCssText: 'backdrop-filter:blur(8px);border-radius:12px;direction:rtl;text-align:right',
};

export const THEME = {
  color: [...PALETTE],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, color: TEXT },
  tooltip: TOOLTIP,
  animationDuration: 1400,
  animationEasing: 'cubicOut',
  animationDurationUpdate: 700,
};

/** ציר בלי קווים מיותרים */
export function axis<T extends object>(o: T): T {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: TEXT, fontFamily: FONT },
    splitLine: { lineStyle: { color: GRID } },
    ...o,
  };
}

/** גרדיאנט אנכי / אופקי (פורמט אובייקט של ECharts, בלי לייבא את הספרייה) */
export function vGrad(a: string, b: string) {
  return { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] };
}
export function hGrad(a: string, b: string) {
  return { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] };
}

/** צבע לפי אחוז נכון: אדום (קשה), זהב, ירוק (קל) */
export function accuracyColor(pct: number) {
  return pct < 40 ? hGrad('#B85C70', '#E58A9B') : pct < 65 ? hGrad('#B08A48', '#F6DFA0') : hGrad('#4FB38C', '#B6F0D8');
}
