import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { AccessFacade } from './access.facade';
@Component({
  selector: 'app-status-page',
  providers: [AccessFacade],
  imports: [EmptyStateComponent, MatButtonModule, TranslocoPipe],
  template: `<div class="status-page">
    <app-empty-state
      [title]="facade.title() | transloco"
      [message]="facade.message() | transloco"
      [icon]="
        facade.kind === 'hq' ? 'warehouse' : facade.kind === 'not-found' ? 'search_off' : 'lock'
      "
    >
      @if (facade.kind === 'no-access') {
        <button mat-stroked-button (click)="facade.retry()">
          {{ 'access.actions.retry' | transloco }}</button
        ><button mat-button (click)="facade.signOut()">
          {{ 'common.actions.signOut' | transloco }}
        </button>
      } @else {
        <button mat-stroked-button (click)="facade.home()">
          {{
            (facade.kind === 'hq'
              ? 'access.actions.viewSalonStock'
              : 'access.actions.goToWorkspace'
            ) | transloco
          }}
        </button>
      }
    </app-empty-state>
  </div>`,
  styles: `
    .status-page {
      max-width: 700px;
      margin: 32px auto;
      padding: 16px;
    }
  `,
})
export class StatusPageComponent {
  readonly facade = inject(AccessFacade);
}
