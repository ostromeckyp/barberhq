import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterOutlet,
} from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map, take } from 'rxjs';
import { FIREBASE } from './core/firebase.providers';
import { runtimeConfig } from './core/public-config';
import { BootSplash } from './shared/ui/boot-splash/boot-splash';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslocoPipe, BootSplash],
  template: `@if (configured) {
      @if (booting()) {
        <app-boot-splash />
      }
      <router-outlet />
    } @else {
      <main class="setup">
        <p class="eyebrow">{{ 'shell.setup.eyebrow' | transloco }}</p>
        <h1>{{ 'shell.setup.title' | transloco }}</h1>
        <p>{{ 'shell.setup.notConfigured' | transloco }}</p>
        <p>{{ 'shell.setup.followGuide' | transloco }}</p>
      </main>
    }`,
  styles: `
    .setup {
      max-width: 580px;
      margin: 12vh auto;
      padding: 24px;
    }
  `,
})
export class App {
  readonly configured = runtimeConfig.publicConfig !== null;
  private readonly firebase = this.configured ? inject(FIREBASE) : null;
  private readonly firstNavigation = inject(Router).events.pipe(
    filter(
      (event) =>
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped,
    ),
    take(1),
  );
  /** True until the first navigation settles; route guards wait for the session meanwhile. */
  protected readonly booting = toSignal(this.firstNavigation.pipe(map(() => false)), {
    initialValue: true,
  });

  constructor() {
    const firebase = this.firebase;
    if (!firebase) return;
    this.firstNavigation.pipe(takeUntilDestroyed()).subscribe(() => {
      const start = () =>
        void firebase
          .appCheck()
          .catch((error: unknown) => console.error('App Check failed to start', error));
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2000 });
      else setTimeout(start, 0);
    });
  }
}
