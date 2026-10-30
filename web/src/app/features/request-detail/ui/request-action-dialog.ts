import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, inject } from '@angular/core';
import { form, FormField, disabled, maxLength } from '@angular/forms/signals';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { pluralKey } from '../../../core/i18n/plural';
import { Language } from '../../../core/language';
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
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ facade.labelKey | transloco }}</h2>
    <mat-dialog-content>
      <p>
        {{ facade.data.request.salonName }} ·
        {{
          itemsKey(facade.data.request.itemCount)
            | transloco: { count: facade.data.request.itemCount }
        }}
        ·
        {{
          unitsKey(facade.data.request.totalUnits)
            | transloco: { count: facade.data.request.totalUnits }
        }}
      </p>
      @for (item of facade.data.request.items; track item.productId; let index = $index) {
        <h3>{{ item.productName }} × {{ item.quantity }}</h3>
        @switch (facade.data.type) {
          @case ('APPROVE') {
            <p>
              {{
                'requests.action.hqAvailable'
                  | transloco
                    : { from: item.stock.hqAvailable, to: item.stock.hqAvailable - item.quantity }
              }}
            </p>
          }
          @case ('DISPATCH') {
            <p>
              {{
                'requests.action.hqOnHand'
                  | transloco
                    : { from: item.stock.hqOnHand, to: item.stock.hqOnHand - item.quantity }
              }}
            </p>
          }
          @case ('RECEIVE') {
            <p>
              {{
                'requests.action.salonOnHand'
                  | transloco
                    : { from: item.stock.salonOnHand, to: item.stock.salonOnHand + item.quantity }
              }}
            </p>
            <mat-form-field appearance="outline"
              ><mat-label>{{
                'requests.action.receivedQuantity' | transloco: { product: item.productName }
              }}</mat-label>
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
          <p>{{ 'requests.action.approveBody' | transloco }}</p>
        }
        @case ('DISPATCH') {
          <p>{{ 'requests.action.dispatchBody' | transloco }}</p>
        }
        @case ('REJECT') {
          <mat-form-field appearance="outline"
            ><mat-label>{{ 'requests.action.reason' | transloco }}</mat-label>
            <textarea matInput [formField]="fields.reason"></textarea>
          </mat-form-field>
        }
        @case ('RECEIVE') {
          <mat-checkbox [formField]="fields.allIntact">{{
            'requests.action.allIntact' | transloco
          }}</mat-checkbox>
          @if (!facade.valid()) {
            <p class="warning" role="status">{{ 'requests.action.receiptBlocked' | transloco }}</p>
          }
        }
      }
      @if (facade.error(); as error) {
        <p role="alert" class="warning">{{ error.key | transloco: error.params }}</p>
      }
      <mat-progress-bar
        *appDelayedLoading="facade.busy()"
        mode="indeterminate"
        [attr.aria-label]="'requests.action.saving' | transloco" /></mat-dialog-content
    ><mat-dialog-actions align="end"
      ><button mat-button mat-dialog-close [disabled]="facade.busy()">
        {{
          (facade.unknown() ? 'requests.action.closeReview' : 'common.actions.cancel') | transloco
        }}</button
      ><button
        mat-flat-button
        (click)="facade.confirm()"
        [disabled]="facade.busy() || (!facade.unknown() && !facade.valid())"
      >
        {{ (facade.unknown() ? 'requests.action.retrySame' : facade.labelKey) | transloco }}
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
  private readonly language = inject(Language);
  itemsKey(count: number): string {
    return pluralKey('requests.count.items', count, this.language.current());
  }
  unitsKey(count: number): string {
    return pluralKey('requests.count.units', count, this.language.current());
  }
  readonly fields = form(this.facade.model, (p) => {
    disabled(p, () => this.facade.busy() || this.facade.unknown());
    maxLength(p.reason, 500);
  });
}
