import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AdminOption {
  optionId: number | null;
  body: string;
  isCorrect: boolean;
}

export interface AdminQuestion {
  questionId: number;
  sortOrder: number;
  body: string;
  imageUrl: string | null;
  fact: string | null;
  timeLimitSec: number | null;
  isActive: boolean;
  /** כבר הוגשה לשחקן: אי אפשר למחוק, רק להשבית */
  inUse: boolean;
  options: AdminOption[];
}

export type QuestionDraft = Omit<AdminQuestion, 'questionId' | 'sortOrder' | 'inUse'> & { questionId: number | null };

export interface ImportRow {
  body: string;
  correct: string;
  wrong: string[];
  fact: string | null;
  timeLimitSec: number | null;
}

/** תשובת שגיאה מהשרת (400) */
export interface AdminError {
  status: string;
  field?: string | null;
  badRow?: number | null;
}

@Injectable({ providedIn: 'root' })
export class QuestionsApi {
  private readonly http = inject(HttpClient);

  list(): Promise<AdminQuestion[]> {
    return firstValueFrom(this.http.get<AdminQuestion[]>('/api/admin/questions'));
  }

  save(draft: QuestionDraft): Promise<{ questionId: number }> {
    return firstValueFrom(this.http.post<{ questionId: number }>('/api/admin/questions', draft));
  }

  remove(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/admin/questions/${id}`));
  }

  reorder(ids: number[]): Promise<unknown> {
    return firstValueFrom(this.http.put('/api/admin/questions/order', ids));
  }

  import(rows: ImportRow[]): Promise<{ imported: number }> {
    return firstValueFrom(this.http.post<{ imported: number }>('/api/admin/questions/import', rows));
  }
}
