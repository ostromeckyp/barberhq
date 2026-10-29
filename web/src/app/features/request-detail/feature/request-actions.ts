import { Service, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { RequestActionDialog } from '../ui/request-action-dialog';
import type { RequestDetail } from '../../../../../../shared/contracts/stock/index';
import type { ActionDialogData, ActionOutcome } from './request-action.facade';
import type { TransitionType } from './action-input';
@Service()
export class RequestActions {
  private readonly dialog = inject(MatDialog);
  open(request: RequestDetail, type: TransitionType) {
    return firstValueFrom(
      this.dialog
        .open<RequestActionDialog, ActionDialogData, ActionOutcome>(RequestActionDialog, {
          data: { request, type },
          width: '520px',
          maxWidth: 'calc(100vw - 24px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        })
        .afterClosed(),
    );
  }
}
