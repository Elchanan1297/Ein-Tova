import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SaveTheDateDisplay } from '../../../core/save-the-date/save-the-date-models';
import type { SaveTheDateView } from '../../save-the-date/ui/save-the-date-screen';

/** כל ההגדרות כפי שהשרת מחזיר. locked = המצב בפועל (אחרי פתיחה אוטומטית) */
export interface SaveTheDateSettings {
  locked: boolean;
  enabled: boolean;
  eventAt: string | null;
  display: SaveTheDateDisplay;
  hebrewText: string | null;
  afterNightfall: boolean;
  headline: string;
  subline: string | null;
  location: string | null;
  showCountdown: boolean;
  autoOpenAt: string | null;
}

export type SaveTheDateRequest = Omit<SaveTheDateSettings, 'locked'>;

export interface SaveTheDateError {
  status: 'BadKey' | 'BadValue';
  field: keyof SaveTheDateRequest | null;
}

@Injectable({ providedIn: 'root' })
export class SaveTheDateApi {
  private readonly http = inject(HttpClient);

  /** מה שבטופס כרגע, לתצוגה המקדימה (גם לפני שמירה) */
  readonly draft = signal<SaveTheDateView | null>(null);

  get(): Promise<SaveTheDateSettings> {
    return firstValueFrom(this.http.get<SaveTheDateSettings>('/api/admin/save-the-date'));
  }

  /** שומר הכול בבת אחת ומחזיר את המצב אחרי השמירה */
  save(req: SaveTheDateRequest): Promise<SaveTheDateSettings> {
    return firstValueFrom(this.http.put<SaveTheDateSettings>('/api/admin/save-the-date', req));
  }
}
