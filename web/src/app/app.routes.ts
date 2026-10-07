import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { SessionFacade } from './features/auth/feature/session.facade';
import { accessGuard } from './core/access.guard';
export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · BarberHQ',
    loadComponent: () =>
      import('./features/login/feature/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'no-access',
    title: 'Access · BarberHQ',
    data: { kind: 'no-access' },
    loadComponent: () =>
      import('./features/access/feature/status-page.component').then((m) => m.StatusPageComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [accessGuard],
    children: [
      {
        path: 'salons/:salonId/settings',
        title: 'Settings · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/salon-settings/feature/salon-settings.component').then(
            (m) => m.SalonSettingsComponent,
          ),
      },
      {
        path: 'salons/:salonId/requests',
        title: 'Requests · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/salon-requests/feature/salon-requests.component').then(
            (m) => m.SalonRequestsComponent,
          ),
      },
      {
        path: 'salons/:salonId',
        title: 'Salon inventory · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/salon-dashboard/feature/salon-dashboard.component').then(
            (m) => m.SalonDashboardComponent,
          ),
      },
      {
        path: 'hq',
        title: 'HQ · BarberHQ',
        data: { kind: 'hq' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/hq-queue/feature/hq-queue.component').then((m) => m.HqQueueComponent),
      },
      {
        path: 'requests/:requestId',
        title: 'Request · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/request-detail/feature/request-detail.component').then(
            (m) => m.RequestDetailComponent,
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        canActivate: [() => inject(Router).parseUrl(inject(SessionFacade).home())],
        loadComponent: () =>
          import('./features/access/feature/status-page.component').then(
            (m) => m.StatusPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found · BarberHQ',
    data: { kind: 'not-found' },
    loadComponent: () =>
      import('./features/access/feature/status-page.component').then((m) => m.StatusPageComponent),
  },
];
