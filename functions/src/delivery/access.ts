import type * as sql from '@barberhq/server';
import { StockError } from '../stock/errors.js';

type Context = sql.ReadDeliveryContextData;
export function authorizeDeliveryContext(c: Context) {
  const member = c.membership,
    request = c.replenishmentRequest;
  if (
    !member ||
    !request ||
    member.businessId !== request.businessId ||
    request.salon.businessId !== member.businessId ||
    request.salon.kind !== 'SALON' ||
    (member.role !== 'HQ' &&
      (member.role !== 'SALON' ||
        !member.salonAccesses_on_membership.some(
          (access) => access.locationId === request.salonId,
        )))
  )
    throw new StockError('FORBIDDEN');
  return { member, request };
}
