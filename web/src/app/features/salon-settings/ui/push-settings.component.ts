import { Component, OnInit, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { PushFacade } from '../feature/push.facade';

/** Notifications section of salon settings; hidden when this device cannot receive push. */
@Component({
  selector: 'app-push-settings',
  imports: [MatButtonModule, TranslocoPipe],
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
            <p role="alert">{{ 'salon.push.error' | transloco }}</p>
          }
        }
      </section>
    }
  `,
})
export class PushSettingsComponent implements OnInit {
  readonly facade = inject(PushFacade);

  ngOnInit(): void {
    void this.facade.init();
  }
}
