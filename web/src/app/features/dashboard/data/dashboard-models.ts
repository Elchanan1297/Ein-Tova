/** הדשבורד (usp_GetDashboard). זמנים בשניות; avgSec = null כשאין מדידה (לא התחיל, או טלפון כשר) */
export interface DashboardSummary {
  guests: number;
  started: number;
  finished: number;
  phonePlayers: number;
  answers: number;
  correctPct: number;
  avgSec: number | null;
  avgScore: number;
  questionCount: number;
  isOpen: boolean;
  published: boolean;
  lastAnswerAt: string | null;
}

export interface DashboardFamily {
  rnk: number;
  familyId: number;
  name: string;
  guests: number;
  players: number;
  finished: number;
  totalScore: number;
  avgScore: number;
  displayScore: number;
  rankBy: 'Total' | 'Average';
  answered: number;
  correct: number;
  correctPct: number;
  avgSec: number | null;
}

export type PlayerStatus = 'none' | 'playing' | 'done';

export interface DashboardPlayer {
  rnk: number | null;
  guestId: number;
  fullName: string;
  familyId: number;
  familyName: string;
  status: PlayerStatus;
  answered: number;
  total: number;
  score: number;
  correctPct: number;
  avgSec: number | null;
  viaPhone: boolean;
  lastAnswerAt: string | null;
}

export interface DashboardQuestion {
  questionId: number;
  sortOrder: number;
  body: string;
  answered: number;
  correct: number;
  correctPct: number;
  avgSec: number | null;
  fastestName: string | null;
  fastestFamily: string | null;
  fastestSec: number | null;
}

export interface Dashboard {
  summary: DashboardSummary;
  families: DashboardFamily[];
  players: DashboardPlayer[];
  questions: DashboardQuestion[];
}

/** זמן מה־DB (UTC בלי Z) → Date */
export function utc(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value + 'Z');
  return isNaN(d.getTime()) ? null : d;
}
