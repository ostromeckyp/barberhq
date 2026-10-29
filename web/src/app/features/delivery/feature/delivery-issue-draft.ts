import { Service, effect, inject, signal } from '@angular/core';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { scopeKey } from './delivery-journal';
import type { DeliveryScope } from '../models/delivery-scope';
@Service()
export class DeliveryIssueDraft {
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  readonly note = signal('');
  private owner: { scope: DeliveryScope; view: 'HQ' | 'SALON' } | null = null;
  constructor() {
    effect(() => {
      const s = this.session.state(),
        w = this.workspace.workspace(),
        owner = this.owner;
      if (!owner) return;
      if (
        s.status === 'SIGNED_OUT' ||
        s.status === 'NO_ACCESS' ||
        (s.status === 'READY' &&
          (s.membership.userId !== owner.scope.userId ||
            s.membership.businessId !== owner.scope.businessId ||
            !s.membership.salonIds.includes(owner.scope.salonId) ||
            (w &&
              (w.kind !== owner.view ||
                (w.kind === 'SALON' && w.salonId !== owner.scope.salonId)))))
      ) {
        this.note.set('');
        this.owner = null;
      }
    });
  }
  activate(scope: DeliveryScope, view: 'HQ' | 'SALON') {
    if (!this.owner || scopeKey(this.owner.scope) !== scopeKey(scope) || this.owner.view !== view) {
      this.note.set('');
      this.owner = { scope, view };
    }
  }
}
