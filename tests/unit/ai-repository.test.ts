import { describe, expect, it } from 'vitest';
import { createSqlAiRepository } from '../../functions/src/ai/repository.ts';

describe('AI SQL result boundary', () => {
  it('accepts a member only with a salon grant in its own business', async () => {
    const operations = {
      readAiActor: async () => ({
        data: {
          membership: {
            uid: 'u',
            businessId: 'b',
            role: 'SALON',
            salonAccesses_on_membership: [
              { locationId: 'foreign', location: { businessId: 'other', kind: 'SALON' } },
              { locationId: 'hq', location: { businessId: 'b', kind: 'HQ' } },
              { locationId: 'salon', location: { businessId: 'b', kind: 'SALON' } },
            ],
          },
        },
      }),
    };
    expect(await createSqlAiRepository({} as never, operations as never).readActor('u')).toEqual({
      uid: 'u',
      businessId: 'b',
      role: 'SALON',
      salonIds: ['salon'],
    });
  });

  it('rejects malformed native result rather than treating it as admission', async () => {
    const operations = { admitAiWindow: async () => ({ data: { admitted: { count: '1' } } }) };
    await expect(
      createSqlAiRepository({} as never, operations as never).increment('u', 'b', 'HQ'),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
