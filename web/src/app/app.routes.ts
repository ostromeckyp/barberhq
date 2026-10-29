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
        path: 'procedures/review/:versionId',
        title: 'Review document · BarberHQ',
        data: { kind: 'hq', workspace: 'HQ' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/procedures/document-review.component').then(
            (m) => m.DocumentReviewComponent,
          ),
      },
      {
        path: 'procedures',
        title: 'Procedures · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/procedures/procedure-page.component').then(
            (m) => m.ProcedurePageComponent,
          ),
      },
      {
        path: 'procedures/sources/:versionId',
        title: 'Source PDF · BarberHQ',
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/procedures/pdf-viewer/pdf-viewer.component').then(
            (m) => m.PdfViewerComponent,
          ),
      },
      {
        path: 'hq/delivery-issues/:issueId',
        title: 'Delivery issue · BarberHQ',
        data: { kind: 'hq', workspace: 'HQ' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/delivery/ui/delivery-issue.component').then(
            (m) => m.DeliveryIssueComponent,
          ),
      },
      {
        path: 'salons/:salonId/delivery-issues/:issueId',
        title: 'Delivery issue · BarberHQ',
        data: { workspace: 'SALON' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/delivery/ui/delivery-issue.component').then(
            (m) => m.DeliveryIssueComponent,
          ),
      },
      {
        path: 'salons/:salonId/requests/:requestId/receipt',
        title: 'Check delivery · BarberHQ',
        data: { workspace: 'SALON' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/delivery/ui/delivery-receipt.component').then(
            (m) => m.DeliveryReceiptComponent,
          ),
      },
      {
        path: 'salons/:salonId/requests/:requestId',
        title: 'Salon request · BarberHQ',
        data: { workspace: 'SALON' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/request-detail/feature/request-detail.component').then(
            (m) => m.RequestDetailComponent,
          ),
      },
      {
        path: 'hq/requests/:requestId',
        title: 'HQ request · BarberHQ',
        data: { kind: 'hq', workspace: 'HQ' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/request-detail/feature/request-detail.component').then(
            (m) => m.RequestDetailComponent,
          ),
      },
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
        path: 'hq/stock/products/new',
        title: 'Add product · BarberHQ',
        data: { kind: 'hq' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/hq-products/feature/product-editor.component').then(
            (m) => m.ProductEditorComponent,
          ),
      },
      {
        path: 'hq/stock/products/:productId',
        title: 'Edit product · BarberHQ',
        data: { kind: 'hq' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/hq-products/feature/product-editor.component').then(
            (m) => m.ProductEditorComponent,
          ),
      },
      {
        path: 'hq/stock',
        title: 'HQ stock · BarberHQ',
        data: { kind: 'hq' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/hq-stock/feature/hq-stock/hq-stock.component').then(
            (m) => m.HqStockComponent,
          ),
      },
      {
        path: 'hq/shorthand',
        title: 'Salon shorthand · BarberHQ',
        data: { kind: 'hq' },
        canActivate: [accessGuard],
        loadComponent: () =>
          import('./features/hq-shorthand/hq-shorthand.component').then(
            (m) => m.HqShorthandComponent,
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
