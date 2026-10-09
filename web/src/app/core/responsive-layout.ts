import { BreakpointObserver } from '@angular/cdk/layout';
import { Service, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Shared viewport state; presentation only, never an authorization boundary. */
@Service()
export class ResponsiveLayout {
  private readonly breakpoints = inject(BreakpointObserver);
  readonly compact = toSignal(
    this.breakpoints.observe('(max-width: 759px)').pipe(map(({ matches }) => matches)),
    { initialValue: this.breakpoints.isMatched('(max-width: 759px)') },
  );
}
