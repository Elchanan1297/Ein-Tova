import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** ההגדרות כפי שנשמרות ב־DB (מחרוזות; null = ריק) */
export interface Settings {
  gameMode: 'Always' | 'Window' | 'Closed';
  opensAt: string | null;
  closesAt: string | null;
  questionCount: string;
  factsLabelCount: string | null;
  secondsPerQuestion: string;
  graceMs: string;
  voiceChance: string;
  leaderboardRank: 'Total' | 'Average';
}

export interface GameStats {
  summary: { guests: number; started: number; finished: number; avgScore: number; activeQuestions: number; isOpen: boolean };
  questions: { questionId: number; sortOrder: number; body: string; answered: number; correct: number; timedOut: number }[];
}

export interface SaveError {
  status: 'BadKey' | 'BadValue';
  field: keyof Settings | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  settings(): Promise<Settings> {
    return firstValueFrom(this.http.get<Settings>('/api/admin/settings'));
  }

  /** מוחק את כל הניסיונות: כל המוזמנים יכולים לשחק שוב. מחזיר כמה אופסו */
  resetAllAttempts(): Promise<{ reset: number }> {
    return firstValueFrom(this.http.post<{ reset: number }>('/api/admin/game/reset-all', null));
  }

  /** שולחים רק את מה שהשתנה; שגיאת אימות חוזרת כ־400 עם SaveError */
  saveSettings(changes: Partial<Settings>): Promise<unknown> {
    return firstValueFrom(this.http.put('/api/admin/settings', changes));
  }
}
