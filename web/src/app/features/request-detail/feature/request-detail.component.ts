import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { buildRequestHistory } from './request-detail.presentation';
import { StatusChip } from '../../replenishment/ui/status-chip';
import { RequestDetailFacade } from './request-detail.facade';
import { ACTION_LABELS } from './action-input';
@Component({
  selector: 'app-request-detail',
  providers: [RequestDetailFacade],
  imports: [
    DelayedLoadingDirective,
    DatePipe,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    StatusChip,
    RouterLink,
  ],
  templateUrl: './request-detail.component.html',
  styleUrl: './request-detail.component.scss',
})
export class RequestDetailComponent {
  readonly facade = inject(RequestDetailFacade);
  readonly labels = ACTION_LABELS;
  readonly history = computed(() => {
    const request = this.facade.request();
    return request ? buildRequestHistory(request) : [];
  });
  readonly issueLink = computed(() => {
    const request = this.facade.request(),
      issue = request?.delivery?.rootIssue;
    if (!request || !issue) return null;
    return this.facade.workspace === 'HQ'
      ? ['/hq', 'delivery-issues', issue.id]
      : ['/salons', request.salonId, 'delivery-issues', issue.id];
  });
  readonly actions = computed(() =>
    [...this.facade.availableActions()].sort(
      (a, b) => Number(b === 'REJECT') - Number(a === 'REJECT'),
    ),
  );
  readonly nextTitle = computed(() => {
    switch (this.facade.request()?.state) {
      case 'PENDING_APPROVAL':
        return this.facade.workspace === 'HQ' ? 'Review and decide' : 'Waiting for HQ approval';
      case 'RESERVED':
        return this.facade.workspace === 'HQ'
          ? 'Ready to dispatch'
          : 'Approved — waiting for dispatch';
      case 'DISPATCHED':
        return this.facade.workspace === 'HQ'
          ? 'Waiting for receipt confirmation'
          : 'On its way — check delivery';
      case 'RECEIVED':
        return 'Completed';
      case 'RECEIVED_WITH_ISSUE':
        return 'Delivery problem reported';
      case 'REJECTED':
        return 'Rejected';
      default:
        return '';
    }
  });
}
