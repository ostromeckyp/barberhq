import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Full-screen wordmark and bar; the same look as the static splash in `index.html`. */
@Component({
  selector: 'app-boot-splash',
  imports: [TranslocoPipe],
  host: { role: 'presentation' },
  template: `<strong>{{ 'common.brand.name' | transloco }}</strong>
    <div class="bar"></div>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: var(--background);
      color: var(--ink);
    }
    strong {
      font-family: 'Archivo Variable', sans-serif;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .bar {
      position: relative;
      width: 120px;
      height: 3px;
      overflow: hidden;
      background: var(--border);
    }
    .bar::after {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 40%;
      background: var(--brand);
      animation: boot-splash-slide 1.2s ease-in-out infinite;
    }
    @keyframes boot-splash-slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(300%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar::after {
        animation: none;
        width: 100%;
      }
    }
  `,
})
export class BootSplash {}
