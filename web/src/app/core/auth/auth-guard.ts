import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';

export const authGuard: CanActivateFn = () =>
  inject(AuthStore).isLoggedIn() || inject(Router).createUrlTree(['/login']);
