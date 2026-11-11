import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminSession } from './admin-session';
import { AuthStore } from './auth-store';
import { LockStore } from '../save-the-date/lock-store';

/**
 * מצרף טוקן לבקשות ה־API: טוקן מנהל ל־/api/admin, טוקן מוזמן לכל השאר.
 * מנהל מחובר שולח את הטוקן שלו גם ב־X-Admin-Token, כדי לראות את האפליקציה בזמן Save the date.
 * טוקן שפג תוקפו → חזרה למסך הכניסה המתאים. 423 (נעול) → מסך Save the date.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const guest = inject(AuthStore);
  const admin = inject(AdminSession);
  const router = inject(Router);
  const lock = inject(LockStore);
  const isAdmin = req.url.startsWith('/api/admin');
  const token = isAdmin ? admin.token() : guest.token();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const adminToken = admin.token();
  if (!isAdmin && adminToken && req.url.startsWith('/api')) headers['X-Admin-Token'] = adminToken;
  const authed = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 423) {
        // האפליקציה ננעלה בזמן שהיא פתוחה: LockStore יעביר למסך
        void lock.refresh();
        return throwError(() => err);
      }
      if (token && err instanceof HttpErrorResponse && err.status === 401) {
        if (isAdmin) {
          admin.logout();
          void router.navigateByUrl('/admin/login');
        } else {
          guest.logout();
          void router.navigateByUrl('/login');
        }
      }
      return throwError(() => err);
    }),
  );
};
