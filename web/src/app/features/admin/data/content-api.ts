import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AdminGreeting {
  greetingId: number | null;
  senderName: string;
  relation: string | null;
  kind: 'text' | 'image' | 'video';
  body: string | null;
  mediaUrl: string | null;
  isActive: boolean;
}

export interface AdminProgramItem {
  itemId: number | null;
  timeText: string;
  title: string;
  icon: string | null;
  isActive: boolean;
}

export type VoiceEventType = 'Welcome' | 'GameStart' | 'Correct' | 'Incorrect' | 'GameEnd' | 'Winner';

export interface AdminVoiceClip {
  clipId: number | null;
  eventType: VoiceEventType;
  fileUrl: string;
  transcript: string;
  isActive: boolean;
}

/** ברכות, תוכנית וקליפים: אותו מבנה (רשימה / שמירה / מחיקה), והעלאת קבצים */
@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);

  list<T>(path: 'greetings' | 'program' | 'voices'): Promise<T[]> {
    return firstValueFrom(this.http.get<T[]>(`/api/admin/${path}`));
  }

  save(path: 'greetings' | 'program' | 'voices', item: object): Promise<{ id: number }> {
    return firstValueFrom(this.http.post<{ id: number }>(`/api/admin/${path}`, item));
  }

  remove(path: 'greetings' | 'program' | 'voices', id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/admin/${path}/${id}`));
  }

  reorderGreetings(ids: number[]): Promise<unknown> {
    return firstValueFrom(this.http.put('/api/admin/greetings/order', ids));
  }

  /** תמונה → WebP בשרת. מחזיר את הכתובת של הגודל הגדול */
  uploadImage(file: File): Promise<string> {
    return this.upload('image', file);
  }

  uploadAudio(file: File): Promise<string> {
    return this.upload('audio', file);
  }

  private async upload(kind: 'image' | 'audio', file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await firstValueFrom(this.http.post<{ url: string }>(`/api/admin/upload/${kind}`, form));
    return res.url;
  }
}

/** הודעת שגיאה להעלאה שנכשלה */
export function uploadError(status: string | undefined): string {
  return status === 'TooBig' ? 'הקובץ גדול מדי.' : status === 'NotImage' ? 'זה לא קובץ תמונה.' : status === 'NotAudio' ? 'סוג קובץ קול לא נתמך (mp3, m4a, aac, ogg, wav).' : 'ההעלאה נכשלה.';
}
