import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Scene = 'welcome' | 'leaderboard' | 'greetings' | 'winner';

export interface Winner {
  families: { name: string; displayScore: number; finished: number }[];
  rankBy: 'Total' | 'Average';
}

export interface ShowState {
  scene: Scene;
  winner: Winner | null;
  changedAt: string;
}

/** שליטה במצגת (מנהל). המסך עצמו מקבל את השינויים ב־SignalR */
@Injectable({ providedIn: 'root' })
export class ShowApi {
  private readonly http = inject(HttpClient);

  state(): Promise<ShowState> {
    return firstValueFrom(this.http.get<ShowState>('/api/admin/show'));
  }

  setScene(scene: Exclude<Scene, 'winner'>): Promise<ShowState> {
    return firstValueFrom(this.http.post<ShowState>('/api/admin/show/scene', { scene }));
  }

  /** מחשב את הזוכה עכשיו ומציג אותו. 400 NoScores אם עוד אף אחד לא סיים */
  announceWinner(): Promise<ShowState> {
    return firstValueFrom(this.http.post<ShowState>('/api/admin/show/winner', null));
  }
}
