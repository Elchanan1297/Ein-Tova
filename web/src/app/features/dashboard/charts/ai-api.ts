import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** OK | Disabled | NoData | Busy (מכסה: "בעוד רגע") | Limit | Unavailable */
export type AiStatusCode = 'OK' | 'Disabled' | 'NoData' | 'Busy' | 'Limit' | 'Unavailable';

export interface Insight {
  id: string;
  icon: string;
  title: string;
  body: string;
  severity: 'positive' | 'info' | 'warning';
  /** טקסטים שהשרת בנה מהנתונים האמיתיים */
  evidence: string[];
}

export interface InsightsResponse {
  status: AiStatusCode;
  insights: Insight[];
  createdAt: string | null;
  model: string | null;
  cached: boolean;
  players: number;
}

export interface AiStatus {
  enabled: boolean;
  configured: boolean;
  publishToViewers: boolean;
  callsLastHour: number;
  maxCallsPerHour: number;
  questionsLeft: number;
}

export interface AskResponse {
  status: AiStatusCode;
  answer: string | null;
  evidence: string[];
}

export interface BlessingResponse {
  status: AiStatusCode;
  text: string | null;
}

/** תובנות AI (מנהל). כל הקריאות ל־AI עצמו יוצאות רק מהשרת */
@Injectable({ providedIn: 'root' })
export class AiApi {
  private readonly http = inject(HttpClient);

  status(): Promise<AiStatus> {
    return firstValueFrom(this.http.get<AiStatus>('/api/admin/ai/status'));
  }
  insights(refresh: boolean): Promise<InsightsResponse> {
    return firstValueFrom(this.http.post<InsightsResponse>('/api/admin/ai/insights', { refresh }));
  }
  ask(question: string): Promise<AskResponse> {
    return firstValueFrom(this.http.post<AskResponse>('/api/admin/ai/ask', { question }));
  }
  blessing(): Promise<BlessingResponse> {
    return firstValueFrom(this.http.post<BlessingResponse>('/api/admin/ai/blessing', {}));
  }
  /** ריק = ביטול הפרסום */
  publish(insights: Insight[]): Promise<{ insights: Insight[] }> {
    return firstValueFrom(this.http.put<{ insights: Insight[] }>('/api/admin/ai/published', { insights }));
  }
  /** url: מנהל (/api/admin/ai/published) או אורחים (/api/results/insights) */
  published(url: string): Promise<{ insights: Insight[] }> {
    return firstValueFrom(this.http.get<{ insights: Insight[] }>(url));
  }
}

export const AI_MESSAGES: Record<Exclude<AiStatusCode, 'OK'>, string> = {
  Disabled: 'התובנות כבויות. אפשר להדליק בהגדרות.',
  NoData: 'אחרי שכמה אנשים ישחקו, יופיעו כאן תובנות.',
  Busy: 'התובנות זמינות בעוד רגע.',
  Limit: 'הגעתם למספר השאלות המרבי.',
  Unavailable: 'התובנות לא זמינות כרגע.',
};
