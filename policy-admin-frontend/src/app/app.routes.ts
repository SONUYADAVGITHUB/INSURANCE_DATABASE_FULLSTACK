import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import.component').then((m) => m.ImportComponent)
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.component').then((m) => m.SearchComponent)
  },
  {
    path: 'aggregates',
    loadComponent: () => import('./features/aggregates/aggregates.component').then((m) => m.AggregatesComponent)
  },
  {
    path: 'schedule',
    loadComponent: () => import('./features/schedule/schedule.component').then((m) => m.ScheduleComponent)
  },
  {
    path: 'system',
    loadComponent: () => import('./features/system/system.component').then((m) => m.SystemComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
