import { randomUUID } from 'node:crypto';
import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import { createCloudHarness } from '../support/cloud.ts';
import { createAiAdmission } from '../../functions/src/ai/admission.ts';
import { createSqlAiRepository } from '../../functions/src/ai/repository.ts';
import { createReplenishmentRepository } from '../../functions/src/ai/replenishment-repository.ts';
import { createSalonAliasCommands } from '../../functions/src/ai/salon-alias-commands.ts';
import { createReplenishmentPreparer } from '../../functions/src/ai/replenishment.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';

type Harness = Awaited<ReturnType<typeof createCloudHarness>>;
async function snapshot(h: Harness) {
  return (
    await h.operator.executeGraphql(
      `query($id:String!){
  inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}
  requests:replenishmentRequests(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id state revision}
  items:requestItems(where:{request:{businessId:{eq:$id}}},orderBy:{id:ASC}){id productId quantity}
  transfers(where:{businessId:{eq:$id}},orderBy:{requestId:ASC}){requestId}
  movements:stockMovements(where:{businessId:{eq:$id}}){_count}
  receipts:actionReceipts(where:{businessId:{eq:$id}}){_count}
}`,
      { variables: { id: h.businessId } },
    )
  ).data;
}

describe('Feature: verified replenishment preparation', () => {
  let h: Harness;
  beforeEach(async () => {
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Use isolated emulator fixtures only');
    h = await createCloudHarness('ordering-ai');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  describe('Given a real scoped catalog and stock in SQL', () => {
    describe('When the assistant prepares three products', () => {
      it('Then the draft uses current records and no operational data changes', async () => {
        const before = await snapshot(h);
        const admission = createAiAdmission(createSqlAiRepository(h.operator));
        const prepare = createReplenishmentPreparer({
          ...admission,
          repository: createReplenishmentRepository(h.operator),
          shorthand: createSalonAliasCommands(h.operator),
          generate: async (_budget, _input, tools) => {
            const matches = await tools.findProduct(['Matowa', 'Sól Morska', 'Savage']);
            await tools.getStockContext(
              matches.flatMap((m) => m.candidates.map((c) => c.productId)),
            );
            return {
              items: [
                { originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 },
                { originalWording: '3 Sól Morska', productQuery: 'Sól Morska', quantity: 3 },
                { originalWording: '1 Savage', productQuery: 'Savage', quantity: 1 },
              ],
            };
          },
        });
        const result = await prepare(h.users.legnicka, {
          salonId: h.legnickaId,
          message: '2 Matowa, 3 Sól Morska, 1 Savage',
        });
        expect(result.status).toBe('PROPOSAL');
        expect(
          result.lines.map((l) =>
            l.status === 'READY'
              ? [l.productId.split(':').at(-1), l.quantity, l.hqAvailable, l.salonOnHand]
              : null,
          ),
        ).toEqual([
          ['NBS-MATOWA-100', 2, 18, 2],
          ['NBS-SOL-200', 3, 18, 2],
          ['NBS-SAVAGE-50', 1, 18, 2],
        ]);
        expect(await snapshot(h)).toEqual(before);
        await expect(
          prepare(h.users.legnicka, { salonId: `${h.businessId}:lodzka`, message: '2 Matowa' }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      });
    });
    describe('When an active request exists or access is revoked during generation', () => {
      it('Then active products are excluded and revoked access cannot return stock', async () => {
        const productId = `${h.businessId}:NBS-MATOWA-100`;
        const created = await new StockRepository(h.operator).execute(h.users.legnicka, {
          type: 'SUBMIT',
          input: {
            salonId: h.legnickaId,
            items: [{ productId, quantity: 2 }],
            idempotencyKey: randomUUID(),
          },
        });
        const before = await snapshot(h);
        const admission = createAiAdmission(createSqlAiRepository(h.operator));
        const generate = async () => ({
          items: [{ originalWording: '2 Matowa', productQuery: 'Matowa', quantity: 2 }],
        });
        const repository = createReplenishmentRepository(h.operator);
        const result = await createReplenishmentPreparer({
          ...admission,
          repository,
          generate,
          shorthand: createSalonAliasCommands(h.operator),
        })(h.users.legnicka, { salonId: h.legnickaId, message: '2 Matowa' });
        expect(result.lines).toEqual([]);
        expect(result.excluded[0]).toMatchObject({ productId, requestId: created.requestId });
        const denied = createReplenishmentPreparer({
          ...admission,
          repository,
          shorthand: createSalonAliasCommands(h.operator),
          generate: async () => {
            await h.operator.executeGraphql(
              'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
              { variables: { uid: h.users.legnicka } },
            );
            return generate();
          },
        });
        await expect(
          denied(h.users.legnicka, { salonId: h.legnickaId, message: '2 Matowa' }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(await snapshot(h)).toEqual(before);
      });
    });
  });
});

describe('Feature: shorthand learning inside one admitted preparation', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createCloudHarness('ordering-learning');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  it('uses one admission, one turn and at most eight tools, and writes receipts only for final clarifications', async () => {
    const before = await snapshot(h);
    const admission = createAiAdmission(createSqlAiRepository(h.operator));
    let budget: {
      deadlineMs: number;
      modelTurnsRemaining: number;
      toolCallsRemaining: number;
    } | null = null;
    let deadline = 0;
    const counts = async () =>
      (
        await h.operator.executeGraphql<
          { usage: { count: number }[]; receipts: { _count: number }[] },
          { id: string; uid: string }
        >(
          'query($id:String!,$uid:String!){usage:aiUsageWindows(where:{uid:{eq:$uid}}){count} receipts:replenishmentChoiceReceipts(where:{businessId:{eq:$id}}){_count}}',
          { variables: { id: h.businessId, uid: h.users.legnicka } },
        )
      ).data;
    const prepare = createReplenishmentPreparer({
      ...admission,
      admitAiCall: async (...args) => {
        const b = await admission.admitAiCall(...args);
        deadline = b.deadlineMs;
        return b;
      },
      repository: createReplenishmentRepository(h.operator),
      shorthand: createSalonAliasCommands(h.operator),
      generate: async (b, input, tools) => {
        budget = b;
        const items = [
          { originalWording: '2 pasta', productQuery: 'pasta', quantity: 2 },
          { originalWording: '1 Savage', productQuery: 'Savage', quantity: 1 },
        ];
        const matches = await tools.findProduct(items.map((i) => i.productQuery));
        await tools.getStockContext(matches[1].candidates.map((c) => c.productId));
        await tools.calculateProposal(items);
        expect((await counts()).receipts[0]._count).toBe(0);
        return { items };
      },
    });
    const result = await prepare(h.users.legnicka, {
      salonId: h.legnickaId,
      message: '2 pasta, 1 Savage',
    });
    expect(result.lines.map((l) => l.status)).toEqual(['NEEDS_CLARIFICATION', 'READY']);
    expect(result.lines[0]).toMatchObject({ choiceReceiptId: expect.any(String) });
    expect(budget!.deadlineMs).toBe(deadline);
    expect(budget!.modelTurnsRemaining).toBe(5);
    expect(budget!.toolCallsRemaining).toBe(8 - 5);
    expect(await counts()).toEqual({ usage: [{ count: 1 }], receipts: [{ _count: 1 }] });
    expect(await snapshot(h)).toEqual(before);
  });
});
