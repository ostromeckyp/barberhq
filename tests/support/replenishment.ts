import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { seedRecords } from '../../scripts/seed/business.ts';
import { validateSeed } from '../../scripts/prepare-data/catalog.ts';
import { knowledgeConnectorConfig, resolveKnowledgeTarget } from './knowledge-target.ts';
import type { ActorContext } from '../../functions/src/ai/models/actor-context.ts';

/** Isolated-emulator business with HQ, two salons, a foreign business and fake (Auth-free) members. */
export async function createLookupHarness(name = 'lookup') {
  const target = resolveKnowledgeTarget({ env: process.env, configPath: null, config: null });
  if (target.mode !== 'emulator') throw new Error('Use isolated emulator fixtures only');
  const suffix = randomUUID();
  const app = initializeApp({ projectId: target.projectId }, `${name}-${suffix}`);
  const dc = getDataConnect(knowledgeConnectorConfig(target, 'server'), app);
  const businessId = `test-${name}-${suffix}`;
  const foreignId = `test-${name}-foreign-${suffix}`;
  const users = {
    hq: `hq-${suffix}`,
    legnicka: `legnicka-${suffix}`,
    lodzka: `lodzka-${suffix}`,
    foreign: `foreign-${suffix}`,
  };
  const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
  async function dispose() {
    for (const id of [businessId, foreignId])
      await dc.executeGraphql('mutation($id:String!){business_delete(id:$id)}', {
        variables: { id },
      });
    for (const uid of Object.values(users))
      await dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid },
      });
    await deleteApp(app);
  }
  try {
    await seedRecords(
      dc,
      seed,
      businessId,
      [
        { uid: users.hq, role: 'HQ', salonKeys: [] },
        { uid: users.legnicka, role: 'SALON', salonKeys: ['legnicka'] },
        { uid: users.lodzka, role: 'SALON', salonKeys: ['lodzka'] },
      ],
      false,
    );
    await seedRecords(
      dc,
      seed,
      foreignId,
      [{ uid: users.foreign, role: 'HQ', salonKeys: [] }],
      false,
    );
  } catch (e) {
    await dispose();
    throw e;
  }
  const legnickaId = `${businessId}:legnicka`;
  const lodzkaId = `${businessId}:lodzka`;
  const hqId = `${businessId}:hq`;
  const actors = {
    hq: { uid: users.hq, businessId, role: 'HQ', salonIds: [] },
    legnicka: { uid: users.legnicka, businessId, role: 'SALON', salonIds: [legnickaId] },
    lodzka: { uid: users.lodzka, businessId, role: 'SALON', salonIds: [lodzkaId] },
    foreign: { uid: users.foreign, businessId: foreignId, role: 'HQ', salonIds: [] },
  } satisfies Record<string, ActorContext>;
  const gql = async <T = Record<string, unknown>>(query: string, variables: object = {}) =>
    (await dc.executeGraphql<T, object>(query, { variables })).data;
  return {
    dc,
    gql,
    businessId,
    foreignId,
    users,
    actors,
    hqId,
    legnickaId,
    lodzkaId,
    productId: (demoId: string) => `${businessId}:${demoId}`,
    async addProducts(count: number, withInventory = true) {
      const ids = Array.from(
        { length: count },
        (_, i) => `${businessId}:extra-${String(i).padStart(4, '0')}`,
      );
      for (let i = 0; i < ids.length; i += 33) {
        const chunk = ids.slice(i, i + 33);
        await gql('mutation($rows:[Product_Data!]!){product_insertMany(data:$rows)}', {
          rows: chunk.map((id) => ({
            id,
            businessId,
            demoId: id.split(':').at(-1),
            name: `Extra ${id.split('-').at(-1)}`,
            brand: 'X',
            category: 'Extra',
            summaryEn: 'Extra',
            sourceCode: id.split('-').at(-1),
            netContentMl: 1,
            retailPriceGrosz: 1,
            sourceUrl: 'https://example.invalid',
            observedOn: '2026-10-28',
          })),
        });
        if (withInventory)
          await gql('mutation($rows:[Inventory_Data!]!){inventory_insertMany(data:$rows)}', {
            rows: chunk.flatMap((productId) =>
              [hqId, legnickaId, lodzkaId].map((locationId) => ({
                locationId,
                productId,
                onHand: 5,
              })),
            ),
          });
      }
      return ids;
    },
    async insertMany(table: string, rows: object[]) {
      for (let i = 0; i < rows.length; i += 100)
        await gql(
          `mutation($rows:[${table[0].toUpperCase()}${table.slice(1)}_Data!]!){${table}_insertMany(data:$rows)}`,
          { rows: rows.slice(i, i + 100) },
        );
    },
    async addAliases(rows: Record<string, unknown>[]) {
      for (let i = 0; i < rows.length; i += 100)
        await gql('mutation($rows:[ProductAlias_Data!]!){productAlias_insertMany(data:$rows)}', {
          rows: rows.slice(i, i + 100).map((r) => ({
            id: randomUUID(),
            businessId,
            kind: 'NAME',
            lang: 'pl',
            source: 'SEED',
            status: 'ACTIVE',
            ambiguous: false,
            createdBy: 'test',
            createdAt: new Date().toISOString(),
            ...r,
          })),
        });
    },
    dispose,
  };
}
export type LookupHarness = Awaited<ReturnType<typeof createLookupHarness>>;
