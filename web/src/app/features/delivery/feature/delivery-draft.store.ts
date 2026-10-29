import { Service, effect, inject, signal, untracked } from '@angular/core';
import type {
  DeliveryQuantities,
  ProcedureReference,
} from '../../../../../../shared/contracts/delivery';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { scopeKey, type DeliveryScope } from './delivery-journal';
export type ReceiptDraft = {
  items: DeliveryQuantities[];
  description: string;
  batchIdentifier: string;
  procedureReferences: ProcedureReference[];
};
const empty = (): ReceiptDraft => ({
  items: [],
  description: '',
  batchIdentifier: '',
  procedureReferences: [],
});
@Service()
export class DeliveryDraftStore {
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  readonly model = signal<ReceiptDraft>(empty());
  readonly scope = signal<DeliveryScope | null>(null);
  constructor() {
    effect(() => {
      const s = this.session.state(),
        workspace = this.workspace.workspace(),
        scope = untracked(this.scope);
      if (!scope) return;
      if (
        s.status === 'SIGNED_OUT' ||
        s.status === 'NO_ACCESS' ||
        (s.status === 'READY' &&
          (s.membership.userId !== scope.userId ||
            s.membership.businessId !== scope.businessId ||
            !s.membership.salonIds.includes(scope.salonId) ||
            (workspace && (workspace.kind !== 'SALON' || workspace.salonId !== scope.salonId))))
      )
        this.clear();
    });
  }
  activate(scope: DeliveryScope, items: DeliveryQuantities[]) {
    const state = this.session.state(),
      workspace = this.workspace.workspace();
    if (
      state.status !== 'READY' ||
      state.membership.userId !== scope.userId ||
      state.membership.businessId !== scope.businessId ||
      !state.membership.salonIds.includes(scope.salonId) ||
      workspace?.kind !== 'SALON' ||
      workspace.salonId !== scope.salonId
    )
      return;
    if (this.scope() && scopeKey(this.scope()!) === scopeKey(scope)) return;
    this.scope.set({ ...scope });
    this.model.set({ ...empty(), items: items.map((row) => ({ ...row })) });
  }
  clear() {
    this.scope.set(null);
    this.model.set(empty());
  }
}
