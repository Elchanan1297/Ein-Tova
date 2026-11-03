export interface FamilyRow {
  rnk: number;
  familyId: number;
  name: string;
  totalScore: number;
  players: number;
  finished: number;
  avgScore: number;
  displayScore: number;
  rankBy: 'Total' | 'Average';
}

export interface TopPlayer {
  fullName: string;
  familyName: string;
  score: number;
  total: number;
}

export interface Leaderboard {
  families: FamilyRow[];
  top: TopPlayer[];
}
