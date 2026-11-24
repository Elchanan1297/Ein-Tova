import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { GlassSelect, SelectOption } from '../../../shared/ui/select/glass-select';
import { Dashboard, DashboardPlayer, DashboardQuestion, PlayerStatus } from '../data/dashboard-models';

export type DashboardTab = 'summary' | 'families' | 'players' | 'questions';
type PlayerSort = 'rank' | 'speed' | 'progress' | 'name';
type QuestionSort = 'order' | 'hard' | 'easy' | 'slow';
type StatusFilter = 'all' | PlayerStatus;

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'summary', label: 'סיכום' },
  { id: 'families', label: 'משפחות' },
  { id: 'players', label: 'שחקנים' },
  { id: 'questions', label: 'שאלות' },
];

/**
 * הדשבורד עצמו (משותף למנהל ולאורחים): סיכום, משפחות, שחקנים ושאלות.
 * אינטראקטיבי: לחיצה על משפחה מסננת את השחקנים, מיון, חיפוש וסינון לפי מצב.
 * admin: גם מי שלא התחיל, מצב "משחק עכשיו" וסימון טלפון כשר.
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
const QUESTION_SORT_OPTIONS: SelectOption<QuestionSort>[] = [
  { value: 'order', label: 'לפי הסדר' },
  { value: 'hard', label: 'הכי קשות' },
  { value: 'easy', label: 'הכי קלות' },
  { value: 'slow', label: 'הכי איטיות' },
];

@Component({
  selector: 'app-dashboard-view',
  imports: [DecimalPipe, GlassSelect],
  templateUrl: './dashboard-view.html',
  styleUrl: './dashboard-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardView {
  readonly data = input.required<Dashboard>();
  readonly admin = input(false);
  /** המשפחה של האורח (להדגשה) */
  readonly myFamilyId = input<number | null>(null);

  protected readonly tabs = TABS;
  protected readonly tab = signal<DashboardTab>('summary');
  protected readonly familyId = signal<number | null>(null);
  protected readonly playerSortOptions = PLAYER_SORT_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly questionSortOptions = QUESTION_SORT_OPTIONS;
  protected readonly playerSort = signal<PlayerSort>('rank');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly search = signal('');
  protected readonly questionSort = signal<QuestionSort>('order');

  protected readonly s = computed(() => this.data().summary);
  protected readonly byAverage = computed(() => this.data().families[0]?.rankBy === 'Average');
  protected readonly startedPct = computed(() => pct(this.s().started, this.s().guests));
  protected readonly finishedPct = computed(() => pct(this.s().finished, this.s().guests));

  /** המשפחות שיש להן משהו להראות (בתצוגה הציבורית: רק מי ששיחקו) */
  protected readonly families = computed(() =>
    this.data().families.filter((f) => this.admin() || f.players > 0),
  );
  protected readonly maxScore = computed(() => Math.max(1, ...this.families().map((f) => f.displayScore)));
  protected readonly selectedFamily = computed(() => this.data().families.find((f) => f.familyId === this.familyId()) ?? null);

  /** המהירים ביותר: מי שסיים, באפליקציה (בטלפון כשר אין מדידה) */
  protected readonly fastest = computed(() =>
    this.data()
      .players.filter((p) => p.status === 'done' && p.avgSec !== null)
      .sort((a, b) => a.avgSec! - b.avgSec!)
      .slice(0, 5),
  );
  protected readonly playingNow = computed(() => this.data().players.filter((p) => p.status === 'playing'));

  protected readonly answeredQuestions = computed(() => this.data().questions.filter((q) => q.answered > 0));
  protected readonly hardest = computed(() => minBy(this.answeredQuestions(), (q) => q.correctPct));
  protected readonly easiest = computed(() => minBy(this.answeredQuestions(), (q) => -q.correctPct));

  protected readonly players = computed(() => {
    const term = this.search().trim();
    const fam = this.familyId();
    const status = this.status();
    const list = this.data().players.filter(
      (p) =>
        (fam === null || p.familyId === fam) &&
        (status === 'all' || p.status === status) &&
        (!term || p.fullName.includes(term) || p.familyName.includes(term)),
    );
    return [...list].sort(PLAYER_SORTS[this.playerSort()]);
  });

  protected readonly questions = computed(() => [...this.data().questions].sort(QUESTION_SORTS[this.questionSort()]));
  protected readonly maxQuestionSec = computed(() => Math.max(1, ...this.data().questions.map((q) => q.avgSec ?? 0)));

  protected showFamily(familyId: number | null): void {
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
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

function minBy<T>(list: T[], key: (t: T) => number): T | null {
  return list.reduce<T | null>((best, t) => (best === null || key(t) < key(best) ? t : best), null);
}

/** בלי מדידת מהירות = בסוף */
const bySpeed = (a: DashboardPlayer, b: DashboardPlayer) => (a.avgSec ?? 1e9) - (b.avgSec ?? 1e9);

const PLAYER_SORTS: Record<PlayerSort, (a: DashboardPlayer, b: DashboardPlayer) => number> = {
  rank: (a, b) => (a.rnk ?? 1e9) - (b.rnk ?? 1e9) || a.fullName.localeCompare(b.fullName, 'he'),
  speed: (a, b) => bySpeed(a, b) || b.score - a.score,
  progress: (a, b) => b.answered / Math.max(1, b.total) - a.answered / Math.max(1, a.total) || b.score - a.score,
  name: (a, b) => a.fullName.localeCompare(b.fullName, 'he'),
};

const QUESTION_SORTS: Record<QuestionSort, (a: DashboardQuestion, b: DashboardQuestion) => number> = {
  order: (a, b) => a.sortOrder - b.sortOrder,
  // שאלות שעוד לא נענו בסוף
  hard: (a, b) => Number(!a.answered) - Number(!b.answered) || a.correctPct - b.correctPct,
  easy: (a, b) => Number(!a.answered) - Number(!b.answered) || b.correctPct - a.correctPct,
  slow: (a, b) => (b.avgSec ?? -1) - (a.avgSec ?? -1),
};
