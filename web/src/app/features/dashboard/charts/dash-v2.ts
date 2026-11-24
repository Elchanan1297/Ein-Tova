import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DashboardPlayer, PlayerStatus } from '../data/dashboard-models';
import { EyeLoader } from '../../../shared/ui/eye-loader/eye-loader';
import { GlassSelect, SelectOption } from '../../../shared/ui/select/glass-select';
import { familyColors } from './chart-theme';
import { CountUp } from './count-up';
import {
  bubbleOption,
  hardestOption,
  heatmapOption,
  histogramOption,
  scatterOption,
  sparkOption,
  stackOption,
  timelineOption,
} from './dash-options';
import { AiInsights } from './ai-insights';
import { AiPublished } from './ai-published';
import { awardsOf, pct, podiumOf, raceRows } from './dash-model';
import { DashStore } from './dash-store';
import { EChart } from './echart';

type Tab = 'summary' | 'families' | 'players' | 'questions';
type PlayerSort = 'rank' | 'speed' | 'progress' | 'name';
type StatusFilter = 'all' | PlayerStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'סיכום' },
  { id: 'families', label: 'משפחות' },
  { id: 'players', label: 'שחקנים' },
  { id: 'questions', label: 'שאלות' },
];

/** היקף טבעת ההתקדמות (r=40) */
const RING = 2 * Math.PI * 40;


/**
 * הדשבורד המתקדם (גרפים, לפי dashboard-spec.md): סיכום, משפחות, שחקנים ושאלות.
 * אותם מספרים כמו הדשבורד הרגיל (usp_GetDashboard), ועוד נתוני הגרפים (usp_GetDashboardCharts).
 * הגרפים של כל טאב נבנים רק כשהטאב נפתח. משותף למנהל (חי) ולאורחים אחרי הפרסום (CHARTS_SOURCE).
 */
const PLAYER_SORT_OPTIONS: SelectOption<PlayerSort>[] = [
  { value: 'rank', label: 'לפי דירוג' },
  { value: 'speed', label: 'הכי מהירים' },
  { value: 'progress', label: 'לפי התקדמות' },
  { value: 'name', label: 'לפי שם' },
];
const STATUS_OPTIONS: SelectOption<StatusFilter>[] = [
  { value: 'all', label: 'כל המצבים' },
  { value: 'playing', label: 'משחקים עכשיו' },
  { value: 'done', label: 'סיימו' },
  { value: 'none', label: 'לא התחילו' },
];

@Component({
  selector: 'app-dash-v2',
  imports: [EChart, CountUp, EyeLoader, AiInsights, AiPublished, GlassSelect],
  providers: [DashStore],
  templateUrl: './dash-v2.html',
  styleUrl: './dash-v2.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashV2 {
  /** מנהל: כולל מי שלא התחיל ומצב כל שחקן. אורחים: רק מי ששיחק */
  readonly admin = input(false);
  /** המשפחה של האורח (להדגשה) */
  readonly myFamilyId = input<number | null>(null);

  protected readonly store = inject(DashStore);
  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('summary');
  protected readonly tabIndex = computed(() => TABS.findIndex((t) => t.id === this.tab()));
  protected readonly ring = RING;

  // סינון השחקנים (כמו בדשבורד הרגיל)
  protected readonly familyId = signal<number | null>(null);
  protected readonly playerSortOptions = PLAYER_SORT_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly playerSort = signal<PlayerSort>('rank');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly search = signal('');

  private readonly full = computed(() => this.store.data());
  protected readonly d = computed(() => this.full()?.data ?? null);
  protected readonly c = computed(() => this.full()?.charts ?? null);
  protected readonly empty = computed(() => (this.d()?.summary.started ?? 0) === 0);

  protected readonly colors = computed(() => familyColors((this.d()?.families ?? []).map((f) => f.familyId)));
  private readonly extra = computed(() => new Map((this.c()?.families ?? []).map((f) => [f.familyId, f])));
  private readonly wrong = computed(() => new Map((this.c()?.topWrong ?? []).map((w) => [w.questionId, w])));

  // ===== סיכום =====
  protected readonly kpi = computed(() => {
    const s = this.d()!.summary;
    const g = this.c()!.general;
    return {
      started: s.started,
      guests: s.guests,
      startedRing: pct(s.started, s.guests) / 100,
      startedChange: g.startedLastHour > 0 ? `▲ ${g.startedLastHour} בשעה האחרונה` : 'אין חדשים בשעה האחרונה',
      finished: s.finished,
      finishedRing: pct(s.finished, s.started) / 100,
      finishedChange: `${pct(s.finished, s.started)}% מהמתחילים`,
      correct: s.correctPct,
      avgSec: s.avgSec,
      median: g.medianSec,
    };
  });

  protected readonly race = computed(() => raceRows(this.d()!.families, this.colors(), !this.admin()));
  protected readonly byAverage = computed(() => this.d()?.families[0]?.rankBy === 'Average');

  protected readonly podium = computed(() => podiumOf(this.d()!.players));
  protected readonly podiumHeight = { 1: 170, 2: 130, 3: 100 } as const;

  protected readonly timeline = computed(() => timelineOption(this.c()!.timeline));
  protected readonly spark = computed(() => sparkOption(this.c()!.timeline));
  protected readonly hasSpark = computed(() => this.c()!.timeline.filter((p) => p.avgSec !== null).length > 1);
  protected readonly histogram = computed(() => histogramOption(this.c()!.responseTimes, this.c()!.general.medianSec));

  // ===== משפחות =====
  protected readonly awards = computed(() => awardsOf(this.d()!.families, this.extra(), this.colors()));
  protected readonly stack = computed(() => stackOption(this.d()!.families, this.extra()));
  protected readonly stackHeight = computed(() => 80 + 44 * Math.max(1, this.d()!.families.filter((f) => f.answered > 0).length));
  protected readonly heatmap = computed(() => heatmapOption(this.d()!.families, this.d()!.questions, this.c()!.heatmap));
  protected readonly heatHeight = computed(() => 110 + 40 * Math.max(1, this.d()!.families.filter((f) => f.answered > 0).length));

  // ===== שחקנים =====
  protected readonly scatter = computed(() => scatterOption(this.d()!.players, this.colors(), this.d()!.summary));
  protected readonly players = computed(() => {
    const term = this.search().trim();
    const fam = this.familyId();
    const status = this.status();
    const list = this.d()!.players.filter(
      (p) =>
        (fam === null || p.familyId === fam) &&
        (status === 'all' || p.status === status) &&
        (!term || p.fullName.includes(term) || p.familyName.includes(term)),
    );
    return [...list].sort(SORTS[this.playerSort()]);
  });

  // ===== שאלות =====
  protected readonly hardest = computed(() => hardestOption(this.d()!.questions, this.wrong()));
  protected readonly hardestHeight = computed(() => 40 + 34 * Math.min(12, Math.max(1, this.d()!.questions.filter((q) => q.answered > 0).length)));
  protected readonly bubble = computed(() => bubbleOption(this.d()!.questions));

  // תקצירים לקוראי מסך
  protected readonly labels = computed(() => {
    const d = this.d()!;
    const top = d.families[0];
    return {
      timeline: `קצב המשחק: ${d.summary.started} התחילו ו־${d.summary.finished} סיימו עד עכשיו.`,
      histogram: `חציון זמן התשובה ${this.c()!.general.medianSec?.toFixed(1) ?? 'לא ידוע'} שניות.`,
      stack: `נכון, שגוי ופג הזמן לכל משפחה. ${top ? `במקום הראשון ${top.name}.` : ''}`,
      heatmap: 'אחוז התשובות הנכונות לכל משפחה בכל שאלה.',
      scatter: `מהירות מול דיוק לכל שחקן. ממוצע הדיוק ${Math.round(d.summary.correctPct)}%.`,
      hardest: 'השאלות שהכי מעט ענו עליהן נכון.',
      bubble: 'כל שאלה לפי זמן מענה ממוצע ואחוז נכון.',
    };
  });

  protected select(tab: Tab): void {
    this.tab.set(tab);
  }

  protected showFamily(familyId: number): void {
    this.familyId.set(familyId);
    this.tab.set('players');
  }

  protected toggleFamily(familyId: number): void {
    this.familyId.update((f) => (f === familyId ? null : familyId));
  }

  protected progress(p: DashboardPlayer): number {
    return pct(p.answered, p.total);
  }

  protected statusLabel(s: PlayerStatus): string {
    return s === 'done' ? 'סיים' : s === 'playing' ? 'משחק עכשיו' : 'לא התחיל';
  }

  protected dash(ratio: number): number {
    return RING * (1 - Math.min(1, Math.max(0, ratio)));
  }
}

const bySpeed = (a: DashboardPlayer, b: DashboardPlayer) => (a.avgSec ?? 1e9) - (b.avgSec ?? 1e9);
const SORTS: Record<PlayerSort, (a: DashboardPlayer, b: DashboardPlayer) => number> = {
  rank: (a, b) => (a.rnk ?? 1e9) - (b.rnk ?? 1e9) || a.fullName.localeCompare(b.fullName, 'he'),
  speed: (a, b) => bySpeed(a, b) || b.score - a.score,
  progress: (a, b) => b.answered / Math.max(1, b.total) - a.answered / Math.max(1, a.total) || b.score - a.score,
  name: (a, b) => a.fullName.localeCompare(b.fullName, 'he'),
};
