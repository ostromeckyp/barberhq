import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataConnect } from 'firebase-admin/data-connect';
import type { PrepareInput, ProposalResult } from '../../shared/contracts/ai.ts';
import type { ClarificationLine } from '../../shared/contracts/draft.ts';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentRepository } from '../../functions/src/ai/replenishment-repository.ts';
import { createReplenishmentPreparer } from '../../functions/src/ai/replenishment.ts';
import { createSalonAliasCommands } from '../../functions/src/ai/salon-alias-commands.ts';
import { createLookupHarness, type LookupHarness } from '../support/replenishment.ts';

function items(message: string) {
  return message.split(', ').map((originalWording) => {
    const [n, ...rest] = originalWording.split(' ');
    return { originalWording, productQuery: rest.join(' '), quantity: Number(n) };
  });
}
type Actor = 'legnicka' | 'lodzka' | 'hq';

describe('Feature: salon shorthand learned from explicit choices', () => {
  let h: LookupHarness;
  beforeEach(async () => {
    h = await createLookupHarness('shorthand');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  const prepare = (actor: Actor, input: PrepareInput, dc: DataConnect = h.dc) =>
    createReplenishmentPreparer({
      resolveActor: async () => h.actors[actor],
      admitAiCall: async () => createAiBudget(Date.now()),
      repository: createReplenishmentRepository(dc),
      generate: async (_b, i, tools) => {
        await tools.calculateProposal(items(i.message));
        return { items: items(i.message) };
      },
      shorthand: createSalonAliasCommands(dc),
    })(h.users[actor], input);
  const salonOf = (actor: Actor) => (actor === 'lodzka' ? h.lodzkaId : h.legnickaId);
  const ask = (actor: Actor, message: string) =>
    prepare(actor, { salonId: salonOf(actor), message });
  const choose = (
    actor: Actor,
    message: string,
    picks: { line: ClarificationLine; productId: string; receipt?: string }[],
  ) =>
    prepare(actor, {
      salonId: salonOf(actor),
      message,
      clarifications: picks.map(({ line, productId, receipt }) => ({
        lineId: line.lineId,
        originalWording: line.originalWording,
        productId,
        ...((receipt ?? line.choiceReceiptId)
          ? { choiceReceiptId: receipt ?? line.choiceReceiptId }
          : {}),
      })),
    });
  const clarification = (r: ProposalResult, i = 0) => {
    const line = r.lines[i];
    if (line.status !== 'NEEDS_CLARIFICATION') throw Error(`line ${i} is ${line.status}`);
    return line;
  };
  const shorthand = async (salonId = h.legnickaId) =>
    (
      await h.gql<{
        productAliases: { id: string; productId: string; status: string; revision: number }[];
      }>(
        'query($s:String!){productAliases(where:{salonId:{eq:$s},source:{eq:SALON_CONFIRMED}},orderBy:{id:ASC}){id productId status revision}}',
        { s: salonId },
      )
    ).productAliases;
  const stock = async () =>
    await h.gql(
      'query($b:String!){inventories(where:{location:{businessId:{eq:$b}}},orderBy:[{locationId:ASC},{productId:ASC}]){onHand reserved version} replenishmentRequests(where:{businessId:{eq:$b}}){id}}',
      { b: h.businessId },
    );
  const cement = () => h.productId('NBS-CEMENT-100');
  const matowa = () => h.productId('NBS-MATOWA-100');

  it('learns one salon meaning from an explicit choice and resolves it next time', async () => {
    const before = await stock();
    const first = await ask('legnicka', '3 pasta');
    const line = clarification(first);
    expect(line.candidates).toHaveLength(6);
    expect(line.choiceReceiptId).toMatch(/^[0-9a-f-]{36}$/);
    const chosen = await choose('legnicka', '3 pasta', [{ line, productId: cement() }]);
    expect(chosen.lines[0]).toMatchObject({ status: 'READY', productId: cement(), quantity: 3 });
    expect(chosen.shorthandLearning).toEqual([{ lineId: line.lineId, status: 'LEARNED' }]);
    expect(await shorthand()).toMatchObject([
      { productId: cement(), status: 'ACTIVE', revision: 1 },
    ]);
    const again = await ask('legnicka', '2 pasty');
    expect(again.lines[0]).toMatchObject({ status: 'READY', productId: cement(), quantity: 2 });
    expect(clarification(await ask('lodzka', '2 pasta')).candidates).toHaveLength(6);
    const replay = await choose('legnicka', '3 pasta', [{ line, productId: cement() }]);
    expect(replay.shorthandLearning).toEqual([{ lineId: line.lineId, status: 'UNCHANGED' }]);
    expect(await stock()).toEqual(before);
  });

  it('refuses receipts reused for another salon user, message or span', async () => {
    const line = clarification(await ask('legnicka', '3 pasta'));
    const foreign = await prepare('lodzka', {
      salonId: h.lodzkaId,
      message: '3 pasta',
      clarifications: [
        {
          lineId: line.lineId,
          originalWording: line.originalWording,
          productId: cement(),
          choiceReceiptId: line.choiceReceiptId,
        },
      ],
    });
    expect(foreign.shorthandLearning).toEqual([
      { lineId: line.lineId, status: 'NOT_SAVED', reason: 'NO_RECEIPT' },
    ]);
    const otherMessage = await prepare('legnicka', {
      salonId: h.legnickaId,
      message: '3 pasta, 1 Cement',
      clarifications: [
        {
          lineId: line.lineId,
          originalWording: line.originalWording,
          productId: cement(),
          choiceReceiptId: line.choiceReceiptId,
        },
      ],
    });
    expect(otherMessage.shorthandLearning).toEqual([
      { lineId: line.lineId, status: 'NOT_SAVED', reason: 'NO_RECEIPT' },
    ]);
    expect(await shorthand()).toEqual([]);
    expect(await shorthand(h.lodzkaId)).toEqual([]);
  });

  it('lets one of two conflicting confirmations win and rejects expired receipts', async () => {
    const a = clarification(await ask('legnicka', '3 pasta'));
    const b = clarification(await ask('legnicka', '1 pasta'));
    const c = clarification(await ask('legnicka', '2 klej'));
    expect(
      (await choose('legnicka', '3 pasta', [{ line: a, productId: cement() }])).shorthandLearning,
    ).toEqual([{ lineId: a.lineId, status: 'LEARNED' }]);
    const losing = await choose('legnicka', '1 pasta', [{ line: b, productId: matowa() }]);
    expect(losing.lines[0]).toMatchObject({ status: 'READY', productId: matowa() });
    expect(losing.shorthandLearning).toEqual([
      { lineId: b.lineId, status: 'NOT_SAVED', reason: 'STALE_STATE' },
    ]);
    expect(await shorthand()).toMatchObject([{ productId: cement(), revision: 1 }]);
    await h.gql(
      'mutation($id:String!){replenishmentChoiceReceipt_update(id:$id,data:{expiresAt:"2020-01-01T00:00:00Z"})}',
      {
        id: c.choiceReceiptId,
      },
    );
    expect(
      (await choose('legnicka', '2 klej', [{ line: c, productId: matowa() }])).shorthandLearning,
    ).toEqual([{ lineId: c.lineId, status: 'NOT_SAVED', reason: 'EXPIRED' }]);
  });

  it('treats inflected variants of one phrase as one salon meaning', async () => {
    const a = clarification(await ask('legnicka', '3 pasta'));
    const b = clarification(await ask('legnicka', '1 pasty'));
    expect(
      (await choose('legnicka', '3 pasta', [{ line: a, productId: cement() }])).shorthandLearning,
    ).toEqual([{ lineId: a.lineId, status: 'LEARNED' }]);
    expect(
      (await choose('legnicka', '1 pasty', [{ line: b, productId: matowa() }])).shorthandLearning,
    ).toEqual([{ lineId: b.lineId, status: 'NOT_SAVED', reason: 'STALE_STATE' }]);
    expect((await shorthand()).map((r) => [r.productId, r.status])).toEqual([[cement(), 'ACTIVE']]);
    expect((await ask('legnicka', '2 pastach')).lines[0]).toMatchObject({
      status: 'READY',
      productId: cement(),
    });
  });
  it('rolls the whole confirmation back inside SQL when a fence fails, and lets one concurrent confirm win', async () => {
    const state = async (receiptId: string) =>
      h.gql<{
        r: { aliasId: string; consumedProductId: string | null };
        l: { productAliasRevision: number };
      }>(
        'query($id:String!,$s:String!){r:replenishmentChoiceReceipt(id:$id){aliasId consumedProductId} l:location(id:$s){productAliasRevision}}',
        { id: receiptId, s: h.legnickaId },
      );
    const confirm = (
      receiptId: string,
      aliasId: string,
      productId: string,
      alias: number,
      salon: number,
    ) =>
      h.dc.executeMutation('ConfirmSalonShorthand', {
        uid: h.users.legnicka,
        businessId: h.businessId,
        salonId: h.legnickaId,
        expectedSalonRevision: salon,
        writesJson: JSON.stringify([
          { receiptId, aliasId, productId, phrase: 'pasta', expectedRevision: alias },
        ]),
        consumeJson: JSON.stringify([{ receiptId, productId }]),
      });
    const a = clarification(await ask('legnicka', '3 pasta'));
    const b = clarification(await ask('legnicka', '1 pasta'));
    const before = await state(a.choiceReceiptId!);
    const rev = before.l.productAliasRevision;
    await expect(confirm(a.choiceReceiptId!, before.r.aliasId, cement(), 5, rev)).rejects.toThrow(
      /STALE_STATE/,
    );
    await expect(
      confirm(a.choiceReceiptId!, before.r.aliasId, cement(), 0, rev + 1),
    ).rejects.toThrow(/STALE_STATE/);
    expect(await state(a.choiceReceiptId!)).toEqual(before);
    expect(await shorthand()).toEqual([]);
    const outcomes = await Promise.allSettled([
      confirm(a.choiceReceiptId!, before.r.aliasId, cement(), 0, rev),
      confirm(b.choiceReceiptId!, before.r.aliasId, matowa(), 0, rev),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    const rows = await shorthand();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ACTIVE', revision: 1 });
    const consumed = [await state(a.choiceReceiptId!), await state(b.choiceReceiptId!)].filter(
      (x) => x.r.consumedProductId,
    );
    expect(consumed).toHaveLength(1);
    expect(consumed[0].r.consumedProductId).toBe(rows[0].productId);
    expect(consumed[0].l.productAliasRevision).toBe(rev + 1);
  });
  it('keeps different phrases independent and never learns opposing choices for one phrase', async () => {
    const mixed = await ask('legnicka', '1 pasta, 2 klej');
    const [p, k] = [clarification(mixed, 0), clarification(mixed, 1)];
    await h.gql(
      'mutation($id:String!){replenishmentChoiceReceipt_update(id:$id,data:{expiresAt:"2020-01-01T00:00:00Z"})}',
      {
        id: k.choiceReceiptId,
      },
    );
    const result = await choose('legnicka', '1 pasta, 2 klej', [
      { line: p, productId: cement() },
      { line: k, productId: matowa() },
    ]);
    expect(result.shorthandLearning).toEqual([
      { lineId: p.lineId, status: 'LEARNED' },
      { lineId: k.lineId, status: 'NOT_SAVED', reason: 'EXPIRED' },
    ]);
    const twice = await ask('legnicka', '1 klej, 2 klej');
    const [x, y] = [clarification(twice, 0), clarification(twice, 1)];
    const opposing = await choose('legnicka', '1 klej, 2 klej', [
      { line: x, productId: cement() },
      { line: y, productId: matowa() },
    ]);
    expect(opposing.lines.map((l) => (l.status === 'READY' ? l.productId : null))).toEqual([
      cement(),
      matowa(),
    ]);
    expect(opposing.shorthandLearning).toEqual([
      { lineId: x.lineId, status: 'NOT_SAVED', reason: 'CONFLICTING_CHOICES' },
      { lineId: y.lineId, status: 'NOT_SAVED', reason: 'CONFLICTING_CHOICES' },
    ]);
    expect((await shorthand()).map((r) => r.productId)).toEqual([cement()]);
  });

  it('lets HQ acting for a salon teach and remove that salon shorthand', async () => {
    const line = clarification(await ask('hq', '3 pasta'));
    expect(line.choiceReceiptId).toMatch(/^[0-9a-f-]{36}$/);
    const chosen = await choose('hq', '3 pasta', [{ line, productId: cement() }]);
    expect(chosen.shorthandLearning).toEqual([{ lineId: line.lineId, status: 'LEARNED' }]);
    expect((await ask('legnicka', '2 pasty')).lines[0]).toMatchObject({
      status: 'READY',
      productId: cement(),
    });
    expect(clarification(await ask('lodzka', '2 pasta')).candidates).toHaveLength(6);
    const [row] = await shorthand();
    const removed = await createSalonAliasCommands(h.dc).remove(h.users.hq, {
      salonId: h.legnickaId,
      aliasId: row.id,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
    });
    expect(removed).toMatchObject({ id: row.id, status: 'retired' });
  });

  it('removes with idempotent retry, keeps a tombstone and never resurrects from an old receipt', async () => {
    const commands = createSalonAliasCommands(h.dc);
    const line = clarification(await ask('legnicka', '3 pasta'));
    await choose('legnicka', '3 pasta', [{ line, productId: cement() }]);
    const [row] = await shorthand();
    const input = {
      salonId: h.legnickaId,
      aliasId: row.id,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
    };
    await expect(commands.remove(h.users.lodzka, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      commands.remove(h.users.legnicka, { ...input, expectedRevision: 7 }),
    ).rejects.toMatchObject({
      code: 'SOURCE_CHANGED',
    });
    const removed = await commands.remove(h.users.legnicka, input);
    expect(removed).toMatchObject({
      id: row.id,
      salonId: h.legnickaId,
      salonName: 'Legnicka',
      productId: cement(),
      productName: 'Pomada Cement',
      phrase: 'pasta',
      revision: 2,
      status: 'retired',
    });
    expect(await commands.remove(h.users.legnicka, input)).toEqual(removed);
    await expect(
      commands.remove(h.users.legnicka, { ...input, expectedRevision: 2 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    const replay = await choose('legnicka', '3 pasta', [{ line, productId: cement() }]);
    expect(replay.shorthandLearning).toEqual([{ lineId: line.lineId, status: 'UNCHANGED' }]);
    expect(await shorthand()).toMatchObject([{ status: 'RETIRED', revision: 2 }]);
    const fresh = clarification(await ask('legnicka', '4 pasta'));
    expect(
      (await choose('legnicka', '4 pasta', [{ line: fresh, productId: matowa() }]))
        .shorthandLearning,
    ).toEqual([{ lineId: fresh.lineId, status: 'LEARNED' }]);
    expect(await shorthand()).toMatchObject([
      { productId: matowa(), status: 'ACTIVE', revision: 3 },
    ]);
  });

  it('rolls back learning when access is revoked during confirmation and enforces the salon bound', async () => {
    const line = clarification(await ask('legnicka', '3 pasta'));
    const revoking = new Proxy(h.dc, {
      get(target, prop, receiver) {
        if (prop !== 'executeMutation') return Reflect.get(target, prop, receiver);
        return async (name: string, vars: object) => {
          if (name === 'ConfirmSalonShorthand')
            await h.gql(
              'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
              {
                uid: h.users.legnicka,
              },
            );
          return target.executeMutation(name, vars);
        };
      },
    });
    const revoked = await prepare(
      'legnicka',
      {
        salonId: h.legnickaId,
        message: '3 pasta',
        clarifications: [
          {
            lineId: line.lineId,
            originalWording: line.originalWording,
            productId: cement(),
            choiceReceiptId: line.choiceReceiptId,
          },
        ],
      },
      revoking,
    );
    expect(revoked.shorthandLearning).toEqual([
      { lineId: line.lineId, status: 'NOT_SAVED', reason: 'UNAVAILABLE' },
    ]);
    expect(await shorthand()).toEqual([]);
    const full = clarification(await ask('lodzka', '3 pasta'));
    await h.addAliases(
      Array.from({ length: 200 }, (_, i) => ({
        productId: cement(),
        phrase: `s${i}`,
        normalized: `s${i}`,
        source: 'SALON_CONFIRMED',
        salonId: h.lodzkaId,
        lang: 'und',
      })),
    );
    expect(
      (await choose('lodzka', '3 pasta', [{ line: full, productId: cement() }])).shorthandLearning,
    ).toEqual([{ lineId: full.lineId, status: 'NOT_SAVED', reason: 'UNAVAILABLE' }]);
  });
});
