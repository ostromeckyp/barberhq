import { Service, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionFacade } from '../../auth/feature/session.facade';

@Service({ autoProvided: false })
export class LoginFacade {
  private readonly session = inject(SessionFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly submitting = signal(false);
  private readonly failure = signal('');
  readonly error = this.failure.asReadonly();
  readonly signInErrorMessage = 'Could not sign in. Check your email and password, then try again.';
  readonly checkingAccess = computed(() => this.session.state().status === 'LOADING');
  readonly busy = computed(() => this.submitting() || this.checkingAccess());

  constructor() {
    effect(() => {
      const state = this.session.state();
      if (state.status === 'READY') {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const allowed = this.session
          .salons()
          .flatMap((s) => [`/salons/${s.id}`, `/salons/${encodeURIComponent(s.id)}`]);
        if (state.membership.role === 'HQ') allowed.push('/hq');
        void this.router.navigateByUrl(
          requested && allowed.includes(requested) ? requested : this.session.home(),
        );
      } else if (state.status === 'NO_ACCESS' || state.status === 'ERROR') {
        void this.router.navigateByUrl('/no-access');
      }
    });
  }

  async signIn(email: string, password: string) {
    if (this.busy()) return;
    this.submitting.set(true);
    this.failure.set('');
    try {
      await this.session.signIn(email.trim(), password);
    } catch {
      this.failure.set(this.signInErrorMessage);
    } finally {
      this.submitting.set(false);
    }
  }
}
