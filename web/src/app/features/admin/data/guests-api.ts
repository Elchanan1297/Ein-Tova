import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AdminFamily {
  familyId: number;
  name: string;
  sortOrder: number;
  guests: number;
}

export interface AdminGuest {
  guestId: number;
  familyId: number;
  fullName: string;
  phone: string | null;
  code: string;
  isActive: boolean;
  /** UTC בלי Z, כמו שמגיע מ־SQL */
  lastSeenAt: string | null;
  gameState: 'None' | 'Playing' | 'Finished';
  score: number | null;
  total: number | null;
}

export interface GuestDraft {
  guestId: number | null;
  familyId: number;
  fullName: string;
  phone: string | null;
  isActive: boolean;
}

export interface GuestImportRow {
  fullName: string;
  family: string;
  phone: string | null;
}

@Injectable({ providedIn: 'root' })
export class GuestsApi {
  private readonly http = inject(HttpClient);

  list(): Promise<{ families: AdminFamily[]; guests: AdminGuest[] }> {
    return firstValueFrom(this.http.get<{ families: AdminFamily[]; guests: AdminGuest[] }>('/api/admin/guests'));
  }

  saveFamily(familyId: number | null, name: string): Promise<{ familyId: number }> {
    return firstValueFrom(this.http.post<{ familyId: number }>('/api/admin/families', { familyId, name }));
  }

  deleteFamily(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/admin/families/${id}`));
  }

  saveGuest(draft: GuestDraft): Promise<{ guestId: number; code: string }> {
    return firstValueFrom(this.http.post<{ guestId: number; code: string }>('/api/admin/guests', draft));
  }

  deleteGuest(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`/api/admin/guests/${id}`));
  }

  newCode(id: number): Promise<{ code: string }> {
    return firstValueFrom(this.http.post<{ code: string }>(`/api/admin/guests/${id}/new-code`, null));
  }

  resetAttempt(id: number): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/admin/guests/${id}/reset`, null));
  }

  import(rows: GuestImportRow[]): Promise<{ imported: number; newFamilies: number }> {
    return firstValueFrom(this.http.post<{ imported: number; newFamilies: number }>('/api/admin/guests/import', rows));
  }
}
