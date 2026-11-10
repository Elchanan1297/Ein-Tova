import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** תמונה שפורסמה, כפי שאורח רואה אותה (הכתובות חתומות ותקפות ליומיים) */
export interface Photo {
  publicId: string;
  caption: string | null;
  yearTaken: number | null;
  yearApprox: boolean;
  whoElse: string | null;
  isFeatured: boolean;
  width: number;
  height: number;
  likes: number;
  likedByMe: boolean;
  thumbUrl: string;
  displayUrl: string;
}

@Injectable({ providedIn: 'root' })
export class GuestPhotosApi {
  private readonly http = inject(HttpClient);

  list(): Promise<Photo[]> {
    return firstValueFrom(this.http.get<Photo[]>('/api/photos'));
  }

  toggleLike(publicId: string): Promise<{ liked: boolean; likes: number }> {
    return firstValueFrom(this.http.put<{ liked: boolean; likes: number }>(`/api/photos/${publicId}/like`, null));
  }
}

/** "שנות ה־70", "שנות ה־2000" */
export function decadeLabel(decade: number | null): string {
  if (decade === null) return 'ללא תאריך';
  return decade < 2000 ? `שנות ה־${decade % 100}` : `שנות ה־${decade}`;
}

export function photoYear(p: Pick<Photo, 'yearTaken' | 'yearApprox'>): string | null {
  return p.yearTaken ? (p.yearApprox ? `בערך ${p.yearTaken}` : String(p.yearTaken)) : null;
}
