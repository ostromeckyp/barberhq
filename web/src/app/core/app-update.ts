import { inject, InjectionToken, Service } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';

/** Seam so tests can observe the reload instead of navigating. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  factory: () => () => document.location.reload(),
});

/** Offers a reload when the service worker has a new app version ready. */
@Service()
export class AppUpdate {
  private readonly updates = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly reload = inject(RELOAD_PAGE);
  private started = false;

  start(): void {
    if (this.started || !this.updates.isEnabled) return;
    this.started = true;
    this.updates.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this.snackBar
          .open(
            this.transloco.translate('app.update.ready'),
            this.transloco.translate('app.update.reload'),
            { duration: undefined },
          )
          .onAction()
          .subscribe(() => this.reload());
      });
  }
}
