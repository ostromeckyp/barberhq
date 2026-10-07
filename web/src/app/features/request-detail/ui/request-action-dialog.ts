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
        <strong>{{ facade.data.request.productName }} × {{ facade.data.request.quantity }}</strong
        ><br />{{ facade.data.request.salonName }}
      </p>
      @switch (facade.data.type) {
        @case ('APPROVE') {
          <p>
            HQ available: {{ facade.data.request.stock.hqAvailable }} →
            {{ facade.data.request.stock.hqAvailable - facade.data.request.quantity }}
          </p>
          <p>These units will be reserved. Physical stock stays unchanged until dispatch.</p>
        }
        @case ('DISPATCH') {
          <p>
            HQ on hand: {{ facade.data.request.stock.hqOnHand }} →
            {{ facade.data.request.stock.hqOnHand - facade.data.request.quantity }}
          </p>
          <p>Confirm only after the products leave HQ.</p>
        }
        @case ('REJECT') {
          <mat-form-field appearance="outline"
            ><mat-label>Reason for rejection</mat-label
            ><textarea matInput [formField]="fields.reason"></textarea>
          </mat-form-field>
        }
        @case ('RECEIVE') {
          <p>
            Salon on hand: {{ facade.data.request.stock.salonOnHand }} →
            {{ facade.data.request.stock.salonOnHand + facade.data.request.quantity }}
          </p>
          <mat-form-field appearance="outline"
            ><mat-label>Received quantity</mat-label
            ><input matInput type="number" step="1" [formField]="fields.receivedQuantity"
          /></mat-form-field>
          <mat-checkbox [formField]="fields.allIntact">All products are intact</mat-checkbox>
          @if (!facade.valid()) {
            <p class="warning" role="status">
              Only a complete, intact delivery can be received. For damaged or missing products,
              leave this request dispatched and contact HQ. Procedure guidance will be available in
              a later stage.
            </p>
          }
        }
      }
      @if (facade.error()) {
        <p role="alert" class="warning">{{ facade.error() }}</p>
      }
      @if (facade.busy()) {
        <mat-progress-bar mode="indeterminate" aria-label="Saving action" />
      }</mat-dialog-content
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
