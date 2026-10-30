import { Service, inject, signal, computed } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { CommandError } from '../../replenishment/data-access/command-error';
import { ACTION_LABELS, canConfirm, buildAction } from './action-input';
import type { TranslatedText } from '../../../core/models/translated-text';
import type { StockAction } from '../../../../../../shared/contracts/stock/index';
import type { ActionDialogData } from '../models/action-dialog-data';
import type { ActionOutcome } from '../models/action-outcome';
import type { Confirmation } from '../models/confirmation';
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
  readonly error = signal<TranslatedText | null>(null);
  /** Translation key of the action label. */
  readonly labelKey = ACTION_LABELS[this.data.type];
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
    this.error.set(null);
    this.dialog.disableClose = true;
    try {
      const result = await this.api.runAction(this.frozen);
      this.dialog.close({ result });
    } catch (error) {
      const code = error instanceof CommandError ? error.code : 'UNKNOWN';
      if (code === 'UNKNOWN') {
        this.unknown.set(true);
        this.error.set({ key: 'requests.action.errors.unknown' });
      } else if (code === 'CLIENT_UPDATE_REQUIRED' && this.data.type === 'RECEIVE') {
        this.unknown.set(true);
        this.error.set({ key: 'requests.action.errors.clientUpdate' });
      } else
        this.dialog.close({
          error:
            code === 'STALE_STATE'
              ? { key: 'requests.action.errors.STALE_STATE' }
              : code === 'INSUFFICIENT_STOCK'
                ? { key: 'requests.action.errors.INSUFFICIENT_STOCK' }
                : { key: 'requests.action.errors.default', params: { code } },
        });
    } finally {
      this.busy.set(false);
      this.dialog.disableClose = false;
    }
  }
}
