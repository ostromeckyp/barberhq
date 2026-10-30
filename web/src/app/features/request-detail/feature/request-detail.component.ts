import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { pluralKey } from '../../../core/i18n/plural';
import { Language } from '../../../core/language';
import { AppDatePipe } from '../../../shared/ui/app-date.pipe';
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
    AppDatePipe,
    TranslocoPipe,
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
  private readonly language = inject(Language);
  productsKey(count: number): string {
    return pluralKey('requests.count.products', count, this.language.current());
  }
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
  /** Translation key of the next-step heading. */
  readonly nextTitleKey = computed(() => {
    const hq = this.facade.workspace === 'HQ';
    switch (this.facade.request()?.state) {
      case 'PENDING_APPROVAL':
        return hq
          ? 'requests.detail.next.title.pendingHq'
          : 'requests.detail.next.title.pendingSalon';
      case 'RESERVED':
        return hq
          ? 'requests.detail.next.title.reservedHq'
          : 'requests.detail.next.title.reservedSalon';
      case 'DISPATCHED':
        return hq
          ? 'requests.detail.next.title.dispatchedHq'
          : 'requests.detail.next.title.dispatchedSalon';
      case 'RECEIVED':
        return 'requests.detail.next.title.received';
      case 'RECEIVED_WITH_ISSUE':
        return 'requests.detail.next.title.issue';
      case 'REJECTED':
        return 'requests.detail.next.title.rejected';
      default:
        return '';
    }
  });
}
