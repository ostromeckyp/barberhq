import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SubmissionOutcome } from '../../../../../../shared/contracts/draft/index';

/** Readable result of a submission: success, failure with conflicts, or unconfirmed. */
@Component({
  selector: 'app-order-outcome',
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (outcome(); as outcome) {
      @switch (outcome.status) {
        @case ('CREATED') {
          <p>{{ 'replenishment.order.outcome.created' | transloco }}</p>
          <a [routerLink]="['/salons', salonId(), 'requests', outcome.requestId]">{{
            'requests.list.open' | transloco
          }}</a>
        }
        @case ('FAILED') {
          <p role="alert">
            {{ 'replenishment.order.failed' | transloco: { code: outcome.code } }}
          </p>
          @for (conflict of outcome.conflicts; track conflict.productId) {
            <a [routerLink]="['/salons', salonId(), 'requests', conflict.requestId]">{{
              'replenishment.order.openExisting'
                | transloco: { product: productName(conflict.productId) }
            }}</a>
          }
        }
        @case ('UNKNOWN') {
          <p>{{ 'replenishment.order.outcome.unknown' | transloco }}</p>
          <a [routerLink]="['/salons', salonId(), 'requests']">{{
            'replenishment.order.outcome.openList' | transloco
          }}</a>
        }
      }
    }
  `,
})
export class OrderOutcome {
  readonly outcome = input<SubmissionOutcome>();
  readonly salonId = input<string | null | undefined>();
  readonly products = input<readonly { productId: string; productName: string }[]>([]);
  private readonly names = computed(
    () => new Map(this.products().map((p) => [p.productId, p.productName])),
  );
  productName(productId: string): string {
    return this.names().get(productId) ?? productId;
  }
}
