import { Component, inject, signal, effect, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { SessionService } from '../core/session.service';
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <mat-toolbar class="toolbar">
      @if (mobile()?.matches) {
        <button mat-icon-button aria-label="Open navigation" (click)="drawer.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a class="brand" [routerLink]="session.home()"
        ><span class="brand-mark">NBS</span><strong>BarberHQ</strong></a
      ><span class="toolbar-space"></span><span class="context">Not Bad Stuff</span
      ><button mat-icon-button [matMenuTriggerFor]="userMenu" aria-label="Account menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu"
        ><button mat-menu-item (click)="signOut()">
          <mat-icon>logout</mat-icon>Sign out
        </button></mat-menu
      ></mat-toolbar
    >
    @if (mobile()?.matches) {
      <div class="mobile-context">Not Bad Stuff <span>Demo workspace</span></div>
    }
    <mat-sidenav-container
      ><mat-sidenav
        #drawer
        [mode]="mobile()?.matches ? 'over' : 'side'"
        [opened]="!mobile()?.matches"
        [style.width.px]="mobile()?.matches ? 280 : 220"
      >
        <div class="nav-label">WORKSPACE</div>
        <mat-nav-list aria-label="Main navigation">
          @if (isHq()) {
            <a mat-list-item routerLink="/hq" routerLinkActive="active" (click)="closeDrawer()"
              ><mat-icon matListItemIcon>warehouse</mat-icon>HQ overview</a
            >
          }
          @for (salon of session.salons(); track salon.id) {
            <a
              mat-list-item
              [routerLink]="['/salons', salon.id]"
              routerLinkActive="active"
              (click)="closeDrawer()"
              ><mat-icon matListItemIcon>storefront</mat-icon>{{ salon.name }}</a
            >
          }
        </mat-nav-list>
        <div class="nav-footer">NOT BAD STUFF<br /><span>Demo workspace</span></div></mat-sidenav
      >
      <mat-sidenav-content
        ><main id="main-content" tabindex="-1">
          @if (session.state().status === 'READY') {
            <router-outlet />
          }
          @if (signOutError()) {
            <p class="error-message" role="alert">{{ signOutError() }}</p>
          }
        </main></mat-sidenav-content
      ></mat-sidenav-container
    >
  `,
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      height: 60px;
      background: #fff;
      border-bottom: 2px solid var(--brand);
      gap: 12px;
      padding: 0 20px;
    }
    .brand {
      display: flex;
      gap: 10px;
      align-items: center;
      text-decoration: none;
      color: var(--ink);
      font-size: 19px;
    }
    .toolbar-space {
      flex: 1;
    }
    .mobile-context {
      height: 40px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      background: white;
      font-size: 12px;
    }
    .mobile-context span {
      color: var(--muted);
    }
    .context {
      font-size: 12px;
      color: var(--muted);
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 20px;
    }
    mat-sidenav-container {
      min-height: calc(100dvh - 60px);
      background: var(--background);
    }
    mat-sidenav {
      background: #fff;
      border-right: 1px solid var(--border);
      border-radius: 0;
    }
    .nav-label {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      letter-spacing: 0.08em;
      color: var(--muted);
      padding: 28px 20px 12px;
    }
    mat-nav-list {
      padding: 0 12px;
    }
    .active {
      background: #f6dcda !important;
    }
    .nav-footer {
      position: absolute;
      bottom: 24px;
      left: 24px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .nav-footer span {
      font-weight: 400;
      color: var(--muted);
      line-height: 2.5;
    }
    main {
      max-width: 1200px;
      padding: 28px;
      margin: auto;
      outline: none;
      box-sizing: border-box;
    }
    .skip-link {
      position: fixed;
      top: -60px;
      left: 16px;
      z-index: 1000;
      background: white;
      padding: 12px;
    }
    .skip-link:focus {
      top: 4px;
    }
    @media (max-width: 759px) {
      .toolbar {
        height: 56px;
        padding: 0 8px;
        gap: 4px;
      }
      .brand {
        font-size: 17px;
      }
      .context {
        display: none;
      }
      main {
        padding: 20px 16px;
      }
      mat-sidenav-container {
        min-height: calc(100dvh - 96px);
      }
    }
  `,
})
export class ShellComponent {
  private readonly drawer = viewChild(MatSidenav);
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly signOutError = signal('');
  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 759px)'));
  // Sidenav auto-closes after navigation through its own link target handler.
  isHq() {
    const state = this.session.state();
    return state.status === 'READY' && state.membership.role === 'HQ';
  }
  closeDrawer() {
    if (this.mobile()?.matches) void this.drawer()?.close();
  }
  constructor() {
    effect(() => {
      const s = this.session.state().status;
      if (s === 'SIGNED_OUT') void this.router.navigateByUrl('/login');
      else if (s === 'NO_ACCESS' || s === 'ERROR') void this.router.navigateByUrl('/no-access');
    });
  }
  async signOut() {
    try {
      await this.session.signOut();
    } catch {
      this.signOutError.set('Could not sign out. Please retry.');
    }
  }
}
