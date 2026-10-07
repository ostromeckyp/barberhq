import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { AccessFacade } from './access.facade';
@Component({
  selector: 'app-status-page',
  providers: [AccessFacade],
  imports: [EmptyStateComponent, MatButtonModule],
  template: `<div class="status-page">
    <app-empty-state
      [title]="facade.title()"
      [message]="facade.message()"
      [icon]="
        facade.kind === 'hq' ? 'warehouse' : facade.kind === 'not-found' ? 'search_off' : 'lock'
      "
    >
      @if (facade.kind === 'no-access') {
        <button mat-stroked-button (click)="facade.retry()">Retry access</button
        ><button mat-button (click)="facade.signOut()">Sign out</button>
      } @else {
        <button mat-stroked-button (click)="facade.home()">
          {{ facade.kind === 'hq' ? 'View salon stock' : 'Go to workspace' }}
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
