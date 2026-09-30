import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { runtimeConfig } from './core/public-config';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `@if (configured) {
      <router-outlet />
    } @else {
      <main class="setup">
        <p class="eyebrow">BARBERHQ</p>
        <h1>Workspace setup required</h1>
        <p>The Firebase connection has not been configured for this build.</p>
        <p>Follow the project’s Firebase setup guide, then rebuild the application.</p>
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
