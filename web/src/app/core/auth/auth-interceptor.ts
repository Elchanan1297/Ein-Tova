import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminSession } from './admin-session';
import { AuthStore } from './auth-store';

/**
 * מצרף טוקן לבקשות ה־API: טוקן מנהל ל־/api/admin, טוקן מוזמן לכל השאר.
 * טוקן שפג תוקפו → חזרה למסך הכניסה המתאים.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const guest = inject(AuthStore);
  const admin = inject(AdminSession);
  const router = inject(Router);
  const isAdmin = req.url.startsWith('/api/admin');
  const token = isAdmin ? admin.token() : guest.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
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
