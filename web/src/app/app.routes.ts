import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin-guard';
import { authGuard } from './core/auth/auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/splash/splash-page') },
  { path: 'login', loadComponent: () => import('./features/login/login-page') },
  { path: 'admin', loadChildren: () => import('./features/admin/admin.routes') },
  // מצגת למסך הגדול: נפתחת במחשב של מי שמפעיל, אחרי כניסת מנהל
  { path: 'show', canActivate: [adminGuard], loadComponent: () => import('./features/show/show-page') },
  {
    path: '',
    canActivate: [authGuard],
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
