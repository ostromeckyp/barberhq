import { Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, map, merge, scan } from 'rxjs';

/** Browser lifecycle only; feature facades decide how to respond. */
@Service()
export class BrowserActivity {
  readonly online = toSignal(
    merge(fromEvent(window, 'online'), fromEvent(window, 'offline')).pipe(
      map(() => navigator.onLine),
    ),
    { initialValue: navigator.onLine },
  );
  readonly refreshTick = toSignal(
    merge(fromEvent(window, 'focus'), fromEvent(window, 'online')).pipe(
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );
}
