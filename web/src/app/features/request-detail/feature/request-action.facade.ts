import { Service, inject, signal, computed } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { CommandError } from '../../replenishment/data-access/command-error';
import {
  ACTION_LABELS,
  canConfirm,
  buildAction,
  type TransitionType,
  type Confirmation,
} from './action-input';
import type {
  RequestDetail,
  StockAction,
  CommandResult,
} from '../../../../../../shared/contracts/stock/index';
export type ActionDialogData = { request: RequestDetail; type: TransitionType };
export type ActionOutcome = { result?: CommandResult; error?: string };
@Service({ autoProvided: false })
export class RequestActionFacade {
  readonly data = inject<ActionDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialogRef<unknown, ActionOutcome>);
  private readonly api = inject(ReplenishmentApi);
  readonly model = signal<Confirmation>({
    reason: '',
    items: this.data.request.items.map((i) => ({
      productId: i.productId,
      receivedQuantity: i.quantity,
    })),
    allIntact: false,
  });
  readonly busy = signal(false);
  readonly unknown = signal(false);
  readonly error = signal('');
  readonly label = ACTION_LABELS[this.data.type];
  readonly valid = computed(() => canConfirm(this.data.type, this.data.request, this.model()));
  private frozen?: StockAction;
  async confirm() {
    if (this.busy() || (!this.unknown() && !this.valid())) return;
    this.frozen ??= buildAction(
      this.data.type,
      this.data.request,
      this.model(),
      crypto.randomUUID(),
    );
    this.busy.set(true);
    this.error.set('');
    this.dialog.disableClose = true;
    try {
      const result = await this.api.runAction(this.frozen);
      this.dialog.close({ result });
    } catch (error) {
      const code = error instanceof CommandError ? error.code : 'UNKNOWN';
      if (code === 'UNKNOWN') {
        this.unknown.set(true);
        this.error.set('Outcome unknown. Retry this same action to check whether it was recorded.');
      } else if (code === 'CLIENT_UPDATE_REQUIRED' && this.data.type === 'RECEIVE') {
        this.unknown.set(true);
        this.error.set(
          'Reload the app to inspect this delivery. Keep this saved action until its result has been reconciled.',
        );
      } else
        this.dialog.close({
          error:
            code === 'STALE_STATE'
              ? 'The request or stock changed. Review the refreshed details before trying again.'
              : code === 'INSUFFICIENT_STOCK'
                ? 'HQ has insufficient available stock.'
                : `Action was not completed (${code}). Review the refreshed details.`,
        });
    } finally {
      this.busy.set(false);
      this.dialog.disableClose = false;
    }
  }
}
