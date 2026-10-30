import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { runtimeConfig } from './core/public-config';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslocoPipe],
  template: `@if (configured) {
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
}
