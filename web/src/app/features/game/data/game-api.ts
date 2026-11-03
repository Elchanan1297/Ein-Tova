import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnswerResult, NextResult, StartResult } from './game-models';

/** קריאות המשחק. כל הלוגיקה (ניקוד, טיימר, סדר) בשרת. */
@Injectable({ providedIn: 'root' })
export class GameApi {
  private readonly http = inject(HttpClient);

  start(): Promise<StartResult> {
    return firstValueFrom(this.http.post<StartResult>('/api/game/start', null));
  }

  next(): Promise<NextResult> {
    return firstValueFrom(this.http.get<NextResult>('/api/game/next'));
  }

  answer(optionId: number): Promise<AnswerResult> {
    return firstValueFrom(this.http.post<AnswerResult>('/api/game/answer', { optionId }));
  }

  timeout(): Promise<AnswerResult> {
    return firstValueFrom(this.http.post<AnswerResult>('/api/game/timeout', null));
  }
}
