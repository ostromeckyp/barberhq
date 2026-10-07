import { Service, inject, signal, computed, resource, effect, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonInventoryFacade } from '../../salon-dashboard/feature/salon-inventory.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import { ReplenishmentApi } from '../data-access/replenishment-api';
import { DraftStore } from './draft.store';
import { SubmissionService } from './submission.service';
import type { ReadyDraftLine } from '../../../../../../shared/contracts/draft';
@Service({ autoProvided: false })
export class OrderFacade {
  readonly inventory = inject(SalonInventoryFacade);
  readonly draft = inject(DraftStore);
  readonly submission = inject(SubmissionService);
  private readonly session = inject(SessionFacade);
  private readonly api = inject(ReplenishmentApi);
  private readonly activity = inject(BrowserActivity);
  private readonly salonId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('salonId'))),
  );
  readonly manual = signal({ productId: '', quantity: 2 });
  readonly notice = signal('');
  readonly staff = computed(
    () =>
      this.session.state().status === 'READY' &&
      (this.session.state() as { membership?: { role: string } }).membership?.role === 'SALON',
  );
  private readonly active = resource({
    params: () => {
      const s = this.session.state(),
        salonId = this.salonId();
      return s.status === 'READY' && salonId
        ? { salonId, userId: s.membership.userId, tick: this.activity.refreshTick() }
        : undefined;
    },
    loader: ({ params }) => this.api.listActive(params.salonId),
  });
  readonly requests = computed(() => (this.active.hasValue() ? this.active.value() : []));
  readonly loading = this.active.isLoading;
  readonly error = computed(() => !!this.active.error());
  readonly pendingElsewhere = computed(
    () => !!this.submission.savedSalonId() && this.submission.savedSalonId() !== this.salonId(),
  );
  readonly savedSalonName = computed(
    () =>
      this.session.salons().find((s) => s.id === this.submission.savedSalonId())?.name ??
      'saved salon',
  );
  readonly results = computed(() =>
    this.submission.rows().filter((row) => row.payload.salonId === this.salonId()),
  );
  readonly locked = computed(() => this.submission.busy() || this.submission.pending());
  readonly canSubmit = computed(
    () =>
      this.staff() && this.draft.canSubmit() && !this.locked() && !this.loading() && !this.error(),
  );
  constructor() {
    effect(() => {
      const scope = this.salonId();
      const session = this.session.state();
      untracked(() => {
        this.draft.clear();
        this.manual.set({ productId: '', quantity: 2 });
        this.notice.set('');
      });
    });
  }
  select(productId: string) {
    this.manual.set({ productId, quantity: 2 });
  }
  activeFor(productId: string) {
    return this.requests().find((r) => r.productId === productId);
  }
  add() {
    const { productId, quantity } = this.manual();
    const row = this.inventory.rows().find((r) => r.productId === productId);
    if (this.locked() || !row || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      return;
    if (this.activeFor(productId)) {
      this.notice.set('Already requested. Open the active request below.');
      return;
    }
    if (
      this.draft.lines().length >= 6 &&
      !this.draft.lines().some((l) => l.status === 'READY' && l.productId === productId)
    ) {
      this.notice.set('The list can contain up to six products.');
      return;
    }
    this.draft.add({
      status: 'READY',
      lineId: crypto.randomUUID(),
      productId,
      productName: row.productName,
      quantity,
      origin: 'manual',
      hqAvailable: row.hqAvailable,
      salonOnHand: row.salonOnHand,
      hqInventoryVersion: row.hqInventoryVersion,
      salonInventoryVersion: row.salonInventoryVersion,
    });
    this.notice.set('');
  }
  async submit() {
    if (!this.canSubmit()) return;
    await this.submission.submit(this.salonId()!, this.draft.lines() as ReadyDraftLine[]);
    this.reconcile();
  }
  async resume() {
    await this.submission.resume(this.salonId()!);
    this.reconcile();
  }
  private reconcile() {
    for (const row of this.submission.rows())
      if (row.status === 'CREATED' || row.status === 'ALREADY_ACTIVE')
        this.draft.remove(row.lineId);
    this.refresh();
  }
  refresh() {
    this.active.reload();
    this.inventory.refresh();
  }
}
