import { BackLink } from '../../../shared/ui/back-link/back-link';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../shared/ui/app-date.pipe';
import { RouterLink } from '@angular/router';
import { form, FormField, disabled, maxLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusChip } from '../../replenishment/ui/status-chip';
import { pluralKey } from '../../../core/i18n/plural';
import { Language } from '../../../core/language';
import { OPEN_PROCEDURE_KEYS, PROCEDURE_KIND_KEYS } from '../feature/procedure-kind-keys';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryIssueFacade } from '../feature/delivery-issue.facade';
@Component({
  selector: 'app-delivery-issue',
  providers: [DeliveryIssueFacade],
  imports: [
    BackLink,
    AppDatePipe,
    TranslocoPipe,
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
    OPENED: 'delivery.issue.event.OPENED',
    REVIEW_STARTED: 'delivery.issue.event.REVIEW_STARTED',
    NOTE_ADDED: 'delivery.issue.event.NOTE_ADDED',
    REPLACEMENT_CREATED: 'delivery.issue.event.REPLACEMENT_CREATED',
    REPLACEMENT_REJECTED: 'delivery.issue.event.REPLACEMENT_REJECTED',
    REPLACEMENT_RECEIVED: 'delivery.issue.event.REPLACEMENT_RECEIVED',
  };
  readonly kindLabels = PROCEDURE_KIND_KEYS;
  readonly openProcedureLabels = OPEN_PROCEDURE_KEYS;
  readonly unavailableLabels = {
    DAMAGED: {
      MISSING: 'delivery.procedure.notAssigned.DAMAGED',
      UNAVAILABLE: 'delivery.procedure.unavailable.DAMAGED',
    },
    MISSING: {
      MISSING: 'delivery.procedure.notAssigned.MISSING',
      UNAVAILABLE: 'delivery.procedure.unavailable.MISSING',
    },
  } as const;
  private readonly language = inject(Language);
  remainingKey(count: number): string {
    return pluralKey('delivery.count.remaining', count, this.language.current());
  }
}
