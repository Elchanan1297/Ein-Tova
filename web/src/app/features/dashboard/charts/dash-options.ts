import type { EChartsCoreOption } from 'echarts/core';
import { DashboardFamily, DashboardPlayer, DashboardQuestion, DashboardSummary, utc } from '../data/dashboard-models';
import { FONT, MINT, ROSE, TEXT, TEXT_STRONG, TOOLTIP, accuracyColor, axis, hGrad, vGrad } from './chart-theme';
import { ChartsBin, ChartsFamily, ChartsHeatCell, ChartsTimelinePoint, ChartsTopWrong } from './dash-store';

/** בונים את ה־option של כל גרף מנתוני האמת. בלי חלוקה באפס ובלי NaN */

const hm = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
const dayHm = new Intl.DateTimeFormat('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

/** קצב המשחק: מצטבר התחילו מול סיימו */
export function timelineOption(points: ChartsTimelinePoint[]): EChartsCoreOption {
  const times = points.map((p) => utc(p.bucketStart));
  const multiDay = times.length > 1 && times[times.length - 1]!.getTime() - times[0]!.getTime() > 20 * 3600_000;
  const fmt = multiDay ? dayHm : hm;
  return {
    grid: { left: 36, right: 16, top: 36, bottom: 28 },
    tooltip: { ...TOOLTIP, trigger: 'axis' },
    legend: { top: 0, right: 10, itemGap: 20, textStyle: { color: TEXT, fontFamily: FONT, fontSize: 13 }, itemWidth: 14, itemHeight: 6, icon: 'roundRect' },
    xAxis: axis({
      type: 'category',
      data: times.map((t) => (t ? fmt.format(t) : '')),
      boundaryGap: false,
      splitLine: { show: false },
      axisLabel: { color: TEXT, fontFamily: FONT, hideOverlap: true },
    }),
    yAxis: axis({ type: 'value', minInterval: 1 }),
    series: [
      {
        name: 'התחילו',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: points.map((p) => p.started),
        lineStyle: { width: 3, color: hGrad('#B08A48', '#F6DFA0') },
        areaStyle: { color: vGrad('rgba(217,182,111,.38)', 'rgba(217,182,111,0)') },
      },
      {
        name: 'סיימו',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: points.map((p) => p.finished),
        lineStyle: { width: 3, color: hGrad('#4FB38C', '#B6F0D8') },
        areaStyle: { color: vGrad('rgba(127,209,176,.3)', 'rgba(127,209,176,0)') },
      },
    ],
  };
}

/** קו קטן של זמן התשובה הממוצע לאורך הערב (בכרטיס) */
export function sparkOption(points: ChartsTimelinePoint[]): EChartsCoreOption {
  const values = points.map((p) => p.avgSec).filter((v): v is number => v !== null);
  return {
    grid: { left: 0, right: 0, top: 6, bottom: 6 },
    tooltip: { show: false },
    xAxis: { show: false, type: 'category', data: values.map((_, i) => i) },
    yAxis: { show: false, type: 'value', min: 'dataMin' },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: values,
        lineStyle: { width: 3, color: hGrad('#B08A48', '#F6DFA0') },
        areaStyle: { color: vGrad('rgba(217,182,111,.4)', 'rgba(217,182,111,0)') },
      },
    ],
  };
}

/** התפלגות זמני התשובה, עם קו חציון */
export function histogramOption(bins: ChartsBin[], medianSec: number | null): EChartsCoreOption {
  const edges = [0, 4, 6, 8, 10, 12, 15, 20, Infinity];
  const medianBin = medianSec === null ? -1 : edges.findIndex((lo, i) => medianSec >= lo && medianSec < edges[i + 1]);
  return {
    grid: { left: 30, right: 10, top: 22, bottom: 28 },
    tooltip: { ...TOOLTIP, trigger: 'axis', formatter: (p: { name: string; value: number }[]) => `${p[0].name} שניות: <b>${p[0].value}</b> תשובות` },
    xAxis: axis({ type: 'category', data: bins.map((b) => b.label), splitLine: { show: false }, axisLabel: { color: TEXT, fontFamily: FONT, interval: 0, fontSize: 11 } }),
    yAxis: axis({ type: 'value', minInterval: 1 }),
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        data: bins.map((b, i) => ({
          value: b.n,
          itemStyle: {
            color: i === medianBin ? vGrad('#F6DFA0', '#B08A48') : vGrad('rgba(217,182,111,.55)', 'rgba(217,182,111,.12)'),
            borderRadius: [8, 8, 0, 0],
            shadowBlur: i === medianBin ? 18 : 0,
            shadowColor: 'rgba(217,182,111,.6)',
          },
        })),
        markLine:
          medianBin < 0
            ? undefined
            : {
                symbol: 'none',
                silent: true,
                lineStyle: { color: MINT, type: 'dashed' },
                label: { formatter: `חציון ${medianSec!.toFixed(1)}`, color: MINT, fontFamily: FONT },
                data: [{ xAxis: medianBin }],
              },
      },
    ],
  };
}

/** מה ענו המשפחות: נכון / שגוי / פג הזמן, באחוזים */
export function stackOption(families: DashboardFamily[], extra: Map<number, ChartsFamily>): EChartsCoreOption {
  const rows = families.filter((f) => f.answered > 0);
  const share = (f: DashboardFamily, n: number) => pct(n, f.answered);
  return {
    grid: { left: 10, right: 16, top: 10, bottom: 36, containLabel: true },
    tooltip: { ...TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,.04)' } }, valueFormatter: (v: number) => `${v}%` },
    legend: { bottom: 0, textStyle: { color: TEXT, fontFamily: FONT }, icon: 'roundRect', itemWidth: 12, itemHeight: 6 },
    // RTL: שמות המשפחות מימין, והעמודות גדלות שמאלה
    xAxis: axis({ type: 'value', max: 100, inverse: true, axisLabel: { color: TEXT, formatter: '{value}%' } }),
    yAxis: axis({ type: 'category', position: 'right', data: rows.map((f) => f.name), inverse: true, splitLine: { show: false }, axisLabel: { color: TEXT_STRONG, fontFamily: FONT, fontSize: 13 } }),
    series: [
      { name: 'נכון', type: 'bar', stack: 'a', barWidth: 20, data: rows.map((f) => share(f, f.correct)), itemStyle: { color: hGrad('#4FB38C', '#B6F0D8') } },
      { name: 'שגוי', type: 'bar', stack: 'a', data: rows.map((f) => share(f, extra.get(f.familyId)?.wrong ?? 0)), itemStyle: { color: hGrad('#E58A9B', '#B85C70') } },
      { name: 'פג הזמן', type: 'bar', stack: 'a', data: rows.map((f) => share(f, extra.get(f.familyId)?.timedOut ?? 0)), itemStyle: { color: 'rgba(255,255,255,.22)' } },
    ],
  };
}

/** מפת חום: משפחה × שאלה, אחוז נכון */
export function heatmapOption(families: DashboardFamily[], questions: DashboardQuestion[], cells: ChartsHeatCell[]): EChartsCoreOption {
  const fams = families.filter((f) => f.answered > 0);
  const qs = [...questions].filter((q) => q.answered > 0).sort((a, b) => a.sortOrder - b.sortOrder);
  const fi = new Map(fams.map((f, i) => [f.familyId, i]));
  const qi = new Map(qs.map((q, i) => [q.questionId, i]));
  const data = cells
    .filter((c) => fi.has(c.familyId) && qi.has(c.questionId) && c.answered > 0)
    .map((c) => [qi.get(c.questionId)!, fi.get(c.familyId)!, pct(c.correct, c.answered), c.answered]);
  return {
    grid: { left: 8, right: 10, top: 6, bottom: 44, containLabel: true },
    tooltip: {
      ...TOOLTIP,
      formatter: (p: { value: number[] }) =>
        `<b>${esc(qs[p.value[0]].body)}</b><br>${esc(fams[p.value[1]].name)}: ${p.value[2]}% נכון (${p.value[3]} ענו)`,
    },
    // RTL: שאלה 1 מימין, ושמות המשפחות מימין
    xAxis: { type: 'category', inverse: true, data: qs.map((_, i) => i + 1), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TEXT } },
    yAxis: { type: 'category', position: 'right', data: fams.map((f) => f.name), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TEXT_STRONG, fontFamily: FONT } },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 140,
      text: ['נכון', 'שגוי'],
      textStyle: { color: TEXT, fontFamily: FONT },
      inRange: { color: ['#2a2f52', '#5b4a52', '#BE9550', '#F6DFA0'] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        itemStyle: { borderRadius: 5, borderColor: '#14172A', borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 14, shadowColor: 'rgba(217,182,111,.7)' } },
      },
    ],
  };
}

/** מהירות מול דיוק: נקודה לכל שחקן (באפליקציה), בצבע המשפחה, עם קווי ממוצע */
export function scatterOption(players: DashboardPlayer[], colors: Map<number, string>, s: DashboardSummary): EChartsCoreOption {
  const pts = players.filter((p) => p.avgSec !== null && p.answered > 0);
  const xs = pts.map((p) => p.avgSec!);
  return {
    grid: { left: 44, right: 20, top: 24, bottom: 44 },
    tooltip: { ...TOOLTIP, formatter: (p: { data: { name: string; value: number[] } }) => `<b>${esc(p.data.name)}</b><br>דיוק ${p.data.value[1]}% · ${p.data.value[0]} שנ׳` },
    xAxis: axis({
      type: 'value',
      name: 'זמן ממוצע (שניות)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: TEXT, fontFamily: FONT },
      min: xs.length ? Math.max(0, Math.floor(Math.min(...xs) - 1)) : 0,
      max: xs.length ? Math.ceil(Math.max(...xs) + 1) : 20,
    }),
    yAxis: axis({ type: 'value', name: 'דיוק %', nameTextStyle: { color: TEXT, fontFamily: FONT }, min: 0, max: 100 }),
    series: [
      {
        type: 'scatter',
        data: pts.map((p) => ({
          name: p.fullName,
          value: [Number(p.avgSec!.toFixed(1)), Math.round(p.correctPct)],
          symbolSize: 14 + p.correctPct / 6,
          itemStyle: { color: colors.get(p.familyId), shadowBlur: 14, shadowColor: 'rgba(0,0,0,.5)', opacity: 0.92 },
        })),
        label: { show: pts.length <= 30, formatter: (p: { data: { name: string } }) => p.data.name, position: 'top', color: TEXT_STRONG, fontFamily: FONT, fontSize: 11 },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(217,182,111,.45)', type: 'dashed' },
          label: { color: '#D9B66F', fontFamily: FONT, position: 'insideEndTop' },
          data: [
            ...(s.avgSec !== null ? [{ xAxis: s.avgSec, label: { formatter: 'ממוצע מהירות' } }] : []),
            { yAxis: s.correctPct, label: { formatter: 'ממוצע דיוק' } },
          ],
        },
      },
    ],
  };
}

/** אילו שאלות היו קשות: 12 הכי קשות, צבע לפי אחוז נכון */
export function hardestOption(questions: DashboardQuestion[], wrong: Map<number, ChartsTopWrong>, scale = 1): EChartsCoreOption {
  const rows = questions.filter((q) => q.answered > 0).sort((a, b) => a.correctPct - b.correctPct).slice(0, 12);
  const short = (t: string) => (t.length > 26 ? t.slice(0, 25) + '…' : t);
  return {
    grid: { left: 50, right: 10, top: 6, bottom: 10, containLabel: true },
    tooltip: {
      ...TOOLTIP,
      formatter: (p: { dataIndex: number }) => {
        const q = rows[p.dataIndex];
        const w = wrong.get(q.questionId);
        const top = w && w.wrongTotal > 0 ? `<br>רוב הטועים בחרו: ${esc(w.topWrong)} (${w.topWrongN} מתוך ${w.wrongTotal})` : '';
        return `<b>${esc(q.body)}</b><br>${Math.round(q.correctPct)}% נכון · ${q.answered} ענו${top}`;
      },
    },
    // RTL: העמודות גדלות מימין (ליד שם השאלה) שמאלה
    xAxis: axis({ type: 'value', max: 100, inverse: true, axisLabel: { show: false }, splitLine: { show: false } }),
    yAxis: axis({
      type: 'category',
      inverse: true,
      position: 'right',
      data: rows.map((q) => short(q.body)),
      splitLine: { show: false },
      axisLabel: { color: TEXT_STRONG, fontFamily: FONT, fontSize: 12.5 },
    }),
    series: [
      {
        type: 'bar',
        barWidth: 16 * scale,
        data: rows.map((q) => ({ value: Math.round(q.correctPct), itemStyle: { color: accuracyColor(q.correctPct), borderRadius: [10, 0, 0, 10] } })),
        showBackground: true,
        backgroundStyle: { color: 'rgba(255,255,255,.05)', borderRadius: 10 },
        label: { show: true, position: 'left', color: '#F8F3EA', fontFamily: FONT, fontWeight: 700, formatter: '{c}%' },
      },
    ],
  };
}

/** מפת קושי: זמן מענה מול דיוק, גודל = כמה ענו. אזור "קשות ואיטיות" */
export function bubbleOption(questions: DashboardQuestion[]): EChartsCoreOption {
  const rows = [...questions].sort((a, b) => a.sortOrder - b.sortOrder).map((q, i) => ({ q, n: i + 1 }))
    .filter((r) => r.q.answered > 0 && r.q.avgSec !== null);
  const xs = rows.map((r) => r.q.avgSec!);
  const maxN = Math.max(1, ...rows.map((r) => r.q.answered));
  const xMax = xs.length ? Math.ceil(Math.max(...xs) + 2) : 20;
  const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  return {
    grid: { left: 44, right: 20, top: 24, bottom: 44 },
    tooltip: { ...TOOLTIP, formatter: (p: { dataIndex: number }) => {
      const r = rows[p.dataIndex];
      return `<b>${esc(r.q.body)}</b><br>דיוק ${Math.round(r.q.correctPct)}% · ${r.q.avgSec} שנ׳ · ${r.q.answered} ענו`;
    } },
    xAxis: axis({ type: 'value', name: 'זמן מענה ממוצע (שניות)', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: TEXT, fontFamily: FONT }, min: 0, max: xMax }),
    yAxis: axis({ type: 'value', name: 'דיוק %', nameTextStyle: { color: TEXT, fontFamily: FONT }, min: 0, max: 100 }),
    series: [
      {
        type: 'scatter',
        data: rows.map((r) => ({
          value: [r.q.avgSec, Math.round(r.q.correctPct)],
          symbolSize: 14 + 26 * (r.q.answered / maxN),
          itemStyle: { color: r.q.correctPct < 40 ? 'rgba(229,138,155,.8)' : r.q.correctPct < 65 ? 'rgba(217,182,111,.8)' : 'rgba(127,209,176,.8)' },
          label: { formatter: String(r.n) },
        })),
        itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0,0,0,.45)' },
        label: { show: true, color: '#14172A', fontWeight: 800, fontFamily: FONT, fontSize: 11 },
        markArea: xs.length
          ? {
              silent: true,
              itemStyle: { color: 'rgba(229,138,155,.07)' },
              label: { color: ROSE, fontFamily: FONT },
              data: [[{ xAxis: Math.round(avg * 10) / 10, yAxis: 0, name: 'קשות ואיטיות' }, { xAxis: xMax, yAxis: 45 }]],
            }
          : undefined,
      },
    ],
  };
}

/**
 * הגדלת כל הטקסטים בגרף (למסך הגדול): כל fontSize מוכפל, ולתוויות בלי גודל נקבע 12×factor.
 * עובר רק על אובייקטים רגילים ומערכים (לא על פונקציות או גרדיאנטים).
 */
export function scaleFonts<T>(option: T, factor: number): T {
  const keys = new Set(['axisLabel', 'label', 'textStyle', 'nameTextStyle']);
  const walk = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = k === 'fontSize' && typeof x === 'number' ? x * factor : walk(x, k);
    if (key && keys.has(key) && out['fontSize'] === undefined) out['fontSize'] = 12 * factor;
    return out;
  };
  return walk(option) as T;
}
