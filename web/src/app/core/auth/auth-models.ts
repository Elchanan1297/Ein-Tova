export interface Guest {
  guestId: number;
  fullName: string;
  familyId: number;
  familyName: string;
  code: string | null;
}

export interface LoginResponse {
  token: string;
  guest: Guest;
}
