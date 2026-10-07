import { Service, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionFacade } from '../features/auth/feature/session.facade';

@Service({ autoProvided: false })
export class ShellFacade {
  private readonly session = inject(SessionFacade);
  private readonly router = inject(Router);
  private readonly failure = signal('');
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly salons = this.session.salons;
  readonly ready = computed(() => this.session.state().status === 'READY');
  readonly isHq = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' && s.membership.role === 'HQ';
  });
  readonly home = computed(() => this.router.parseUrl(this.session.home()));
  readonly role = computed(() => (this.isHq() ? 'HQ team' : 'Salon staff'));
  readonly context = computed(() => {
    const segments = this.router.parseUrl(this.url()).root.children[PRIMARY_OUTLET]?.segments;
    const id = segments?.[0]?.path === 'salons' ? segments[1]?.path : undefined;
    return (
      this.salons().find((s) => s.id === id)?.name ??
      (this.isHq() ? 'HQ' : (this.salons()[0]?.name ?? 'Salon'))
    );
  });
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
