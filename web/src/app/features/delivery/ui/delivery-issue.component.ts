import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { form, FormField, disabled, maxLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusChip } from '../../replenishment/ui/status-chip';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryIssueFacade } from '../feature/delivery-issue.facade';
@Component({
  selector: 'app-delivery-issue',
  providers: [DeliveryIssueFacade],
  imports: [
    DatePipe,
    RouterLink,
    FormField,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    StatusChip,
    DelayedLoadingDirective,
  ],
  templateUrl: './delivery-issue.component.html',
  styleUrl: './delivery-issue.component.scss',
})
export class DeliveryIssueComponent {
  readonly facade = inject(DeliveryIssueFacade);
  readonly note = form(this.facade.draft.note, (p) => {
    maxLength(p, 1000);
    disabled(p, { when: () => this.facade.locked() || this.facade.issue()?.status === 'RESOLVED' });
  });
  readonly eventLabels = {
    OPENED: 'Problem reported',
    REVIEW_STARTED: 'Review started',
    NOTE_ADDED: 'HQ note',
    REPLACEMENT_CREATED: 'Replacement created',
    REPLACEMENT_REJECTED: 'Replacement rejected',
    REPLACEMENT_RECEIVED: 'Replacement inspected',
  };
  readonly sourceLabels = { DAMAGED: 'damaged product', MISSING: 'missing product' };
}
