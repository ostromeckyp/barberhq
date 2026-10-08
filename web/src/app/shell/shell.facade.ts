import { Service, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  readonly isHqUser = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' && s.membership.role === 'HQ';
  });
  readonly isHqWorkspace = computed(() => this.salonContext.workspace()?.kind === 'HQ');
  readonly isActingForSalon = computed(
    () => this.isHqUser() && this.salonContext.workspace()?.kind === 'SALON',
  );
  readonly home = this.salonContext.home;
  readonly selectedSalonId = this.salonContext.salonId;
  readonly navSalonId = this.selectedSalonId;
  readonly selectedWorkspace = this.salonContext.selectedWorkspace;
  readonly workspaceLabel = computed(() => {
    if (this.isHqWorkspace()) return 'HQ';
    const salonId = this.selectedSalonId();
    const name = this.salons().find((salon) => salon.id === salonId)?.name;
    return name ? `Salon — ${name}` : 'Select workspace';
  });
  readonly actingSalonName = computed(
    () => this.salons().find((salon) => salon.id === this.selectedSalonId())?.name ?? 'salon',
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

  switchWorkspace(value: string) {
    if (value === 'HQ' || value.startsWith('SALON:'))
      void this.salonContext.switchWorkspace(value as 'HQ' | `SALON:${string}`);
  }
}
