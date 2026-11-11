import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/admin-guard';

export default [
  { path: 'login', loadComponent: () => import('./login/admin-login-page') },
  // תצוגה מקדימה במסך מלא, בלי מעטפת הניהול
  {
    path: 'save-the-date/preview',
    canActivate: [adminGuard],
    loadComponent: () => import('./save-the-date/save-the-date-preview'),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/admin-shell'),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'settings' },
      { path: 'settings', loadComponent: () => import('./settings/settings-page') },
      { path: 'questions', loadComponent: () => import('./questions/questions-page') },
      { path: 'guests', loadComponent: () => import('./guests/guests-page') },
      {
        path: 'content',
        loadComponent: () => import('./content/content-shell'),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'greetings' },
          { path: 'greetings', loadComponent: () => import('./content/greetings/greetings-admin') },
          { path: 'program', loadComponent: () => import('./content/program/program-admin') },
          { path: 'voices', loadComponent: () => import('./content/voices/voices-admin') },
        ],
      },
      { path: 'photos', loadComponent: () => import('./photos/photos-page') },
      { path: 'show', loadComponent: () => import('./show/show-control') },
      { path: 'save-the-date', loadComponent: () => import('./save-the-date/save-the-date-admin') },
    ],
  },
] satisfies Routes;
