import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { RequestList } from '../../replenishment/ui/request-list';
import { SalonRequestsFacade } from './salon-requests.facade';
@Component({
  selector: 'app-salon-requests',
  providers: [SalonRequestsFacade],
  imports: [
    DelayedLoadingDirective,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    PageHeader,
    RequestList,
    TranslocoPipe,
  ],
  templateUrl: './salon-requests.component.html',
  styleUrl: './salon-requests.component.scss',
})
export class SalonRequestsComponent {
  readonly facade = inject(SalonRequestsFacade);
}
