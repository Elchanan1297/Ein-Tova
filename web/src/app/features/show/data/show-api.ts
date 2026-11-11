import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Scene = 'welcome' | 'leaderboard' | 'greetings' | 'winner' | 'quiz';

export interface Winner {
  families: { name: string; displayScore: number; finished: number }[];
  rankBy: 'Total' | 'Average';
}

/** החידון על המסך. correct ו־fact מגיעים רק אחרי חשיפת התשובה */
export interface ShowQuiz {
  index: number;
  total: number;
  phase: 'question' | 'reveal' | 'done';
  auto: boolean;
  phaseAt: string;
  endsAt: string | null;
  nextAt: string | null;
  serverNow: string;
  question: {
    body: string;
    imageUrl: string | null;
    timeLimitSec: number;
    fact: string | null;
    options: { id: number; body: string; correct: boolean | null }[];
  } | null;
  stats: { answered: number; correct: number } | null;
}

export interface ShowState {
  scene: Scene;
  winner: Winner | null;
  changedAt: string;
  quiz: ShowQuiz | null;
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

  /** החידון על המסך: start מתחיל מחדש, next/prev/reveal צעד אחד. 400 NoQuestions אם אין שאלות */
  quiz(action: 'start' | 'next' | 'prev' | 'reveal'): Promise<ShowState> {
    return firstValueFrom(this.http.post<ShowState>(`/api/admin/show/quiz/${action}`, null));
  }

  quizAuto(on: boolean): Promise<ShowState> {
    return firstValueFrom(this.http.post<ShowState>('/api/admin/show/quiz/auto', { on }));
  }

  /** מחשב את הזוכה עכשיו ומציג אותו. 400 NoScores אם עוד אף אחד לא סיים */
  announceWinner(): Promise<ShowState> {
    return firstValueFrom(this.http.post<ShowState>('/api/admin/show/winner', null));
  }
}
