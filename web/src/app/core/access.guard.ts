import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SessionFacade } from '../features/auth/feature/session.facade';
import { SalonContext } from './salon-context';
export const accessGuard: CanActivateFn = async (route, state) => {
  const session = inject(SessionFacade),
    router = inject(Router),
    context = inject(SalonContext);
  const current = await session.resolved();
  if (current.status === 'SIGNED_OUT')
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (current.status !== 'READY') return router.parseUrl('/no-access');
  const id = route.paramMap.get('salonId');
  if (
    (id && !session.canOpen(id)) ||
    (route.data['kind'] === 'hq' && current.membership.role !== 'HQ') ||
    (route.data['workspace'] === 'HQ' && context.workspace()?.kind !== 'HQ')
  )
    return router.parseUrl('/no-access');
  return true;
};
