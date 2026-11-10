import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** 0=טיוטה 1=פורסמה 2=מוסתרת */
export type PhotoStatus = 0 | 1 | 2;

export interface AdminPhoto {
  publicId: string;
  caption: string | null;
  yearTaken: number | null;
  yearApprox: boolean;
  /** 0=ידני 1=EXIF 2=Drive 3=תאריך הקובץ (לא בטוח) */
  yearSource: number;
  whoElse: string | null;
  status: PhotoStatus;
  isFeatured: boolean;
  width: number;
  height: number;
  sourceName: string | null;
  likes: number;
  thumbUrl: string;
  displayUrl: string;
  origUrl: string;
}

export interface PhotoCounts {
  drafts: number;
  published: number;
  hidden: number;
  noYear: number;
}

/** שדות לעדכון. מה שלא נשלח לא משתנה; yearTaken: null מוחק שנה */
export interface PhotoPatch {
  caption?: string | null;
  yearTaken?: number | null;
  yearApprox?: boolean;
  whoElse?: string | null;
  isFeatured?: boolean;
  status?: PhotoStatus;
}

export interface UploadResult {
  status: 'OK' | 'Duplicate';
  publicId: string;
}

@Injectable({ providedIn: 'root' })
export class PhotosApi {
  private readonly http = inject(HttpClient);

  list(status: PhotoStatus | null): Promise<{ photos: AdminPhoto[]; counts: PhotoCounts }> {
    const q = status === null ? '' : `?status=${status}`;
    return firstValueFrom(this.http.get<{ photos: AdminPhoto[]; counts: PhotoCounts }>(`/api/admin/photos${q}`));
  }

  /** קובץ אחד. שגיאה: 415 BadType, 413 TooLarge, 507 StorageFull, עם הודעה בעברית */
  upload(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<UploadResult>('/api/admin/photos', form));
  }

  update(publicId: string, patch: PhotoPatch): Promise<unknown> {
    return firstValueFrom(this.http.patch(`/api/admin/photos/${publicId}`, patch));
  }

  bulk(ids: string[], patch: PhotoPatch): Promise<{ updated: number }> {
    return firstValueFrom(this.http.post<{ updated: number }>('/api/admin/photos/bulk', { ids, ...patch }));
  }

  remove(publicId: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/admin/photos/${publicId}`));
  }
}

export const DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export function yearLabel(p: Pick<AdminPhoto, 'yearTaken' | 'yearApprox'>): string {
  if (!p.yearTaken) return 'חסר תאריך';
  return p.yearApprox ? `בערך ${p.yearTaken}` : String(p.yearTaken);
}
