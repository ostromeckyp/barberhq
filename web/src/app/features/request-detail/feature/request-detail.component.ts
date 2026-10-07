import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatusChip, STATUSES } from '../../replenishment/ui/status-chip';
import { RequestDetailFacade } from './request-detail.facade';
import { ACTION_LABELS } from './action-input';
@Component({
  selector: 'app-request-detail',
  providers: [RequestDetailFacade],
  imports: [DatePipe, MatButtonModule, MatProgressBarModule, PageHeader, StatusChip],
  templateUrl: './request-detail.component.html',
  styleUrl: './request-detail.component.scss',
})
export class RequestDetailComponent {
  readonly facade = inject(RequestDetailFacade);
  readonly labels = ACTION_LABELS;
  readonly statuses = STATUSES;
}
