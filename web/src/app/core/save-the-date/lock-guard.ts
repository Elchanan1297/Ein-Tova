import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LockStore, SAVE_THE_DATE_PATH } from './lock-store';

/** בזמן נעילה: כל ניווט של מוזמן (כולל קישור עמוק וקישור כניסה עם קוד) → מסך Save the date */
export const lockGuard: CanActivateFn = () =>
  !inject(LockStore).lockedOut() || inject(Router).createUrlTree([SAVE_THE_DATE_PATH]);

/** מסך Save the date רק בזמן נעילה; אחרת חזרה לאפליקציה */
export const saveTheDateScreenGuard: CanActivateFn = () =>
  inject(LockStore).locked() || inject(Router).createUrlTree(['/']);
