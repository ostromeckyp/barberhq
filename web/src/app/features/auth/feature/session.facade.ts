import { Service, signal, inject, DestroyRef } from '@angular/core';
import { DELIVERY_JOURNAL } from '../../delivery/feature/delivery-journal';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import type { SessionState } from '../../../../../../shared/contracts/business/index';
import { SESSION_GATEWAY } from '../data-access/session.gateway';
import type { SalonOption } from '../models/salon-option';
@Service()
export class SessionFacade {
  private readonly deliveryJournal = inject(DELIVERY_JOURNAL);
  private readonly gateway = inject(SESSION_GATEWAY);
  private readonly current = signal<SessionState>({ status: 'LOADING' });
  readonly state = this.current.asReadonly();
  private readonly availableSalons = signal<SalonOption[]>([]);
  readonly salons = this.availableSalons.asReadonly();
  private readonly changes = toObservable(this.state);
  private generation = 0;
  private uid: string | null = null;
  constructor() {
    const stop = this.gateway.observe((uid) => {
      void this.resolve(uid);
    });
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
      stop();
    });
  }
  private async resolve(uid: string | null) {
    const generation = ++this.generation;
    this.uid = uid;
    this.availableSalons.set([]);
    if (!uid) {
      this.current.set({ status: 'SIGNED_OUT' });
      return;
    }
    this.current.set({ status: 'LOADING' });
    try {
      const result = await this.gateway.membership();
      if (generation !== this.generation) return;
      if (!result || result.membership.userId !== uid) {
        this.current.set({ status: 'NO_ACCESS' });
        return;
      }
      this.availableSalons.set(result.salons);
      this.current.set({ status: 'READY', membership: result.membership });
    } catch {
      if (generation === this.generation) this.current.set({ status: 'ERROR' });
    }
  }
  signIn(email: string, password: string) {
    return this.gateway.signIn(email, password);
  }
  async signOut() {
    if (this.uid) {
      try {
        this.deliveryJournal.clearUser(this.uid);
      } catch {
        /* Browser storage may be blocked; access remains scoped to its original user. */
      }
    }
    ++this.generation;
    this.uid = null;
    this.availableSalons.set([]);
    this.current.set({ status: 'SIGNED_OUT' });
    // Feature data lives in session-scoped signals; never preserve drafts across users.
    try {
      await this.gateway.signOut();
    } catch {
      this.current.set({ status: 'ERROR' });
      throw new Error('Could not finish signing out. Please retry.');
    }
  }
  retry() {
    return this.resolve(this.uid);
  }
  resolved() {
    return this.state().status === 'LOADING'
      ? firstValueFrom(this.changes.pipe(filter((s) => s.status !== 'LOADING')))
      : Promise.resolve(this.state());
  }
  home() {
    const s = this.state();
    return s.status === 'READY' && s.membership.role === 'HQ'
      ? '/hq'
      : this.salons()[0]
        ? `/salons/${encodeURIComponent(this.salons()[0].id)}`
        : '/no-access';
  }
  canOpen(id: string) {
    const s = this.state();
    return s.status === 'READY' && s.membership.salonIds.includes(id);
  }
}
