import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin-guard';
import { authGuard } from './core/auth/auth-guard';
import { lockGuard, saveTheDateScreenGuard } from './core/save-the-date/lock-guard';

export const routes: Routes = [
  // lockGuard: בזמן Save the date מוזמנים מגיעים רק למסך הנעילה (המנהל ממשיך כרגיל)
  { path: '', pathMatch: 'full', canActivate: [lockGuard], loadComponent: () => import('./features/splash/splash-page') },
  { path: 'login', canActivate: [lockGuard], loadComponent: () => import('./features/login/login-page') },
  {
    path: 'save-the-date',
    canActivate: [saveTheDateScreenGuard],
    loadComponent: () => import('./features/save-the-date/save-the-date-page'),
  },
  { path: 'admin', loadChildren: () => import('./features/admin/admin.routes') },
  // מצגת למסך הגדול: נפתחת במחשב של מי שמפעיל, אחרי כניסת מנהל
  { path: 'show', canActivate: [adminGuard], loadComponent: () => import('./features/show/show-page') },
  {
    path: '',
    canActivate: [lockGuard, authGuard],
    canActivateChild: [lockGuard],
    loadComponent: () => import('./layout/shell/shell'),
    children: [
      { path: 'home', loadComponent: () => import('./features/home/home-page') },
      { path: 'leaderboard', loadComponent: () => import('./features/leaderboard/leaderboard-page') },
      { path: 'greetings', loadComponent: () => import('./features/greetings/greetings-page') },
      { path: 'photos', loadComponent: () => import('./features/photos/photos-page') },
      { path: 'game', loadChildren: () => import('./features/game/game.routes') },
      { path: 'program', loadComponent: () => import('./features/program/program-page') },
    ],
  },
  { path: '**', redirectTo: '' },
];
