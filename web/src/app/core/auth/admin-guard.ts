import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminSession } from './admin-session';

export const adminGuard: CanActivateFn = () =>
  inject(AdminSession).isLoggedIn() || inject(Router).createUrlTree(['/admin/login']);
