import { Routes } from '@angular/router';

// בהמשך: intro → question → summary
export default [{ path: '', loadComponent: () => import('./game-page') }] satisfies Routes;
