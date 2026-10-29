import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
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
    MatButtonToggleModule,
    MatProgressBarModule,
    PageHeader,
    RequestList,
  ],
  templateUrl: './salon-requests.component.html',
  styleUrl: './salon-requests.component.scss',
})
export class SalonRequestsComponent {
  readonly facade = inject(SalonRequestsFacade);
}
