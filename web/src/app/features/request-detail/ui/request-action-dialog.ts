import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, inject } from '@angular/core';
import { form, FormField, disabled, maxLength } from '@angular/forms/signals';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RequestActionFacade } from '../feature/request-action.facade';
@Component({
  selector: 'app-request-action-dialog',
  providers: [RequestActionFacade],
  imports: [
    FormField,
    DelayedLoadingDirective,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ facade.label }}</h2>
    <mat-dialog-content>
      <p>
        {{ facade.data.request.salonName }} · {{ facade.data.request.itemCount }} items ·
        {{ facade.data.request.totalUnits }} units
      </p>
      @for (item of facade.data.request.items; track item.productId; let index = $index) {
        <h3>{{ item.productName }} × {{ item.quantity }}</h3>
        @switch (facade.data.type) {
          @case ('APPROVE') {
            <p>
              HQ available: {{ item.stock.hqAvailable }} →
              {{ item.stock.hqAvailable - item.quantity }}
            </p>
          }
          @case ('DISPATCH') {
            <p>HQ on hand: {{ item.stock.hqOnHand }} → {{ item.stock.hqOnHand - item.quantity }}</p>
          }
          @case ('RECEIVE') {
            <p>
              Salon on hand: {{ item.stock.salonOnHand }} →
              {{ item.stock.salonOnHand + item.quantity }}
            </p>
            <mat-form-field appearance="outline"
              ><mat-label>Received quantity · {{ item.productName }}</mat-label>
              <input
                matInput
                type="number"
                inputmode="numeric"
                step="1"
                [formField]="fields.items[index].receivedQuantity"
              />
            </mat-form-field>
          }
        }
      }
      @switch (facade.data.type) {
        @case ('APPROVE') {
          <p>Reserve all products together. Physical stock stays unchanged until dispatch.</p>
        }
        @case ('DISPATCH') {
          <p>Confirm only after all products leave HQ.</p>
        }
        @case ('REJECT') {
          <mat-form-field appearance="outline"
            ><mat-label>Reason for rejection</mat-label>
            <textarea matInput [formField]="fields.reason"></textarea>
          </mat-form-field>
        }
        @case ('RECEIVE') {
          <mat-checkbox [formField]="fields.allIntact">All products are intact</mat-checkbox>
          @if (!facade.valid()) {
            <p class="warning" role="status">
              Receipt blocked. Contact HQ about missing or damaged products. The whole request
              remains dispatched until every product arrives intact.
            </p>
          }
        }
      }
      @if (facade.error()) {
        <p role="alert" class="warning">{{ facade.error() }}</p>
      }
      <mat-progress-bar
        *appDelayedLoading="facade.busy()"
        mode="indeterminate"
        aria-label="Saving action" /></mat-dialog-content
    ><mat-dialog-actions align="end"
      ><button mat-button mat-dialog-close [disabled]="facade.busy()">
        {{ facade.unknown() ? 'Close and review' : 'Cancel' }}</button
      ><button
        mat-flat-button
        (click)="facade.confirm()"
        [disabled]="facade.busy() || (!facade.unknown() && !facade.valid())"
      >
        {{ facade.unknown() ? 'Retry same action' : facade.label }}
      </button></mat-dialog-actions
    >
  `,
  styles: [
    `
      mat-form-field {
        display: block;
        width: 100%;
      }
      .warning {
        padding: 12px;
        background: var(--warning-background);
        color: var(--warning-text);
        border-radius: 8px;
      }
      mat-dialog-actions {
        flex-wrap: wrap;
        gap: 8px;
      }
      p {
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class RequestActionDialog {
  readonly facade = inject(RequestActionFacade);
  readonly fields = form(this.facade.model, (p) => {
    disabled(p, () => this.facade.busy() || this.facade.unknown());
    maxLength(p.reason, 500);
  });
}
