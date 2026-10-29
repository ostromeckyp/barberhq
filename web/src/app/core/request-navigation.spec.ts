import { expect, it } from 'vitest';
import { parseListContext, requestReturnContext } from './request-navigation';
import type { RequestSummary } from '../../../../shared/contracts/stock/index';
const request = { salonId: 's' } as RequestSummary;
const member = { userId: 'u', businessId: 'b', role: 'SALON' as const, salonIds: ['s', 's2'] };
it('bounds_return_context_and_rejects_external_urls', () => {
  expect(parseListContext({ returnUrl: 'https://example.com' })).toBeUndefined();
  expect(parseListContext({ kind: 'SALON', salonId: 's', filter: 'bad', offset: -1 })).toEqual({
    kind: 'SALON',
    salonId: 's',
    filter: 'ALL',
    offset: 0,
  });
  expect(parseListContext({ kind: 'HQ', offset: Number.MAX_SAFE_INTEGER })).toEqual({
    kind: 'HQ',
    offset: 0,
  });
  expect(
    requestReturnContext(request, member, {
      kind: 'SALON',
      salonId: 'foreign',
      filter: 'ALL',
      offset: 0,
    }),
  ).toEqual({ kind: 'SALON', salonId: 's', filter: 'ALL', offset: 0 });
  expect(requestReturnContext(request, { ...member, role: 'HQ' })).toEqual({
    kind: 'HQ',
    offset: 0,
  });
  expect(() => requestReturnContext(request, { ...member, salonIds: [] })).toThrow();
});

it('url_workspace_overrides_conflicting_return_state', () => {
  const hq = { ...member, role: 'HQ' as const };
  expect(requestReturnContext(request, hq, { kind: 'HQ', offset: 50 }, 'SALON')).toEqual({
    kind: 'SALON',
    salonId: 's',
    filter: 'ALL',
    offset: 0,
  });
  expect(
    requestReturnContext(
      request,
      hq,
      { kind: 'SALON', salonId: 's', filter: 'REJECTED', offset: 50 },
      'HQ',
    ),
  ).toEqual({ kind: 'HQ', offset: 0 });
});
