import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { SessionService } from './core/session.service';
import { accessGuard } from './core/access.guard';
export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · BarberHQ',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'no-access',
    title: 'Access · BarberHQ',
    data: { kind: 'no-access' },
    loadComponent: () =>
      import('./shared/status-page.component').then((m) => m.StatusPageComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [accessGuard],
    children: [
      {
        path: 'salons/:salonId',
        title: 'Salon inventory · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/salon-dashboard/salon-dashboard.component').then(
            (m) => m.SalonDashboardComponent,
          ),
      },
      {
        path: 'hq',
        title: 'HQ · BarberHQ',
        data: { kind: 'hq' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./shared/status-page.component').then((m) => m.StatusPageComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        canActivate: [() => inject(Router).parseUrl(inject(SessionService).home())],
        loadComponent: () =>
          import('./shared/status-page.component').then((m) => m.StatusPageComponent),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found · BarberHQ',
    data: { kind: 'not-found' },
    loadComponent: () =>
      import('./shared/status-page.component').then((m) => m.StatusPageComponent),
  },
];
