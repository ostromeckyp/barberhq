import { Service, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SalonContext } from '../core/salon-context';
import { SessionFacade } from '../features/auth/feature/session.facade';

@Service({ autoProvided: false })
export class ShellFacade {
  private readonly session = inject(SessionFacade);
  private readonly router = inject(Router);
  private readonly failure = signal('');
  readonly salonContext = inject(SalonContext);
  readonly salons = this.session.salons;
  readonly ready = computed(() => this.session.state().status === 'READY');
  readonly isHq = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' && s.membership.role === 'HQ';
  });
  readonly home = computed(() => this.router.parseUrl(this.session.home()));
  readonly role = computed(() => (this.isHq() ? 'HQ team' : 'Salon staff'));
  readonly selectedSalonId = this.salonContext.salonId;
  readonly navSalonId = computed(() => this.selectedSalonId() ?? this.salons()[0]?.id);
  readonly context = computed(
    () =>
      this.salons().find((s) => s.id === this.selectedSalonId())?.name ??
      (this.router.url.startsWith('/requests/') ? 'Loading salon…' : this.isHq() ? 'HQ' : 'Salon'),
  );
  readonly signOutError = this.failure.asReadonly();
  constructor() {
    effect(() => {
      const status = this.session.state().status;
      if (status === 'SIGNED_OUT') void this.router.navigateByUrl('/login');
      else if (status === 'NO_ACCESS' || status === 'ERROR')
        void this.router.navigateByUrl('/no-access');
    });
  }
  async signOut() {
    this.failure.set('');
    try {
      await this.session.signOut();
    } catch {
      this.failure.set('Could not sign out. Please retry.');
    }
  }
}
