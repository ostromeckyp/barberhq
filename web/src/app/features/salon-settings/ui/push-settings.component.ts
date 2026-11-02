import { Component, inject, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { StaleBannerComponent } from '../../../shared/ui/stale-banner/stale-banner.component';
import { PushFacade } from '../feature/push.facade';

/** Notifications section of salon settings; hidden when this device cannot receive push. */
@Component({
  selector: 'app-push-settings',
  imports: [MatButtonModule, StaleBannerComponent, TranslocoPipe],
  template: `
    @if (facade.available() && facade.status() !== 'unsupported') {
      <section aria-labelledby="push-settings">
        <h2 id="push-settings">{{ 'salon.push.title' | transloco }}</h2>
        @switch (facade.status()) {
          @case ('default') {
            <button mat-stroked-button [disabled]="facade.busy()" (click)="facade.enable()">
              {{ 'salon.push.enable' | transloco }}
            </button>
          }
          @case ('granted') {
            <p>{{ 'salon.push.on' | transloco }}</p>
            <button mat-button [disabled]="facade.busy()" (click)="facade.disable()">
              {{ 'salon.push.disable' | transloco }}
            </button>
          }
          @case ('denied') {
            <p>{{ 'salon.push.denied' | transloco }}</p>
          }
          @case ('install-required') {
            <p>{{ 'salon.push.install' | transloco }}</p>
          }
          @case ('error') {
            <app-stale-banner [message]="'salon.push.error' | transloco">
              <button mat-button [disabled]="facade.busy()" (click)="facade.enable()">
                {{ 'salon.push.retry' | transloco }}
              </button>
            </app-stale-banner>
          }
        }
      </section>
    }
  `,
})
export class PushSettingsComponent {
  readonly facade = inject(PushFacade);

  constructor() {
    // The service worker may have registered after the sign-in check: retry silently.
    if (untracked(this.facade.status) === 'unsupported') void this.facade.init();
  }
}
