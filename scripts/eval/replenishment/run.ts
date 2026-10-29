import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../../../tests/support/cloud.ts';
import { createAiAdmission } from '../../../functions/src/ai/admission.ts';
import { createSqlAiRepository } from '../../../functions/src/ai/repository.ts';
import { createSalonAliasCommands } from '../../../functions/src/ai/salon-alias-commands.ts';
import { createReplenishmentRepository } from '../../../functions/src/ai/replenishment-repository.ts';
import { createReplenishmentPreparer } from '../../../functions/src/ai/replenishment.ts';
import {
  generateReplenishment,
  replenishmentReasoningConfig,
} from '../../../functions/src/ai/replenishment-model.ts';
import { createAiRuntime } from '../../../functions/src/ai/runtime.ts';
import { StockRepository } from '../../../functions/src/stock/repository.ts';

type Case = {
  id: string;
  message: string;
  status: string[];
  ready?: [string, number][];
  active?: boolean;
  shortage?: boolean;
};
const reasoning = replenishmentReasoningConfig;
async function run() {
  if (
    process.env.BARBERHQ_TEST_MODE !== 'emulator' ||
    process.env.BARBERHQ_TEST_CONFIG ||
    process.env.DATA_CONNECT_EMULATOR_HOST !== '127.0.0.1:9399'
  )
    throw Error('Evaluation requires isolated local SQL/Auth fixtures; only inference uses Vertex');
  const cases: Case[] = JSON.parse(
    await readFile(new URL('./cases.json', import.meta.url), 'utf8'),
  );
  const chosen = process.env.BARBERHQ_EVAL_CASE
    ? cases.filter((c) => c.id === process.env.BARBERHQ_EVAL_CASE)
    : cases;
  if (!chosen.length) throw Error('Unknown evaluation case');
  const h = await createCloudHarness('live-ordering-eval');
  const admission = createAiAdmission(createSqlAiRepository(h.operator));
  const prepare = createReplenishmentPreparer({
    ...admission,
    repository: createReplenishmentRepository(h.operator),
    generate: generateReplenishment,
    shorthand: createSalonAliasCommands(h.operator),
  });
  const stock = new StockRepository(h.operator);
  async function snapshot() {
    return (
      await h.operator.executeGraphql(
        `query($id:String!){
    inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}
    requests:replenishmentRequests(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id state revision}
    items:requestItems(where:{request:{businessId:{eq:$id}}},orderBy:{id:ASC}){id productId quantity}
    transfers(where:{businessId:{eq:$id}}){_count}
    movements:stockMovements(where:{businessId:{eq:$id}}){_count}
    receipts:actionReceipts(where:{businessId:{eq:$id}}){_count}
  }`,
        { variables: { id: h.businessId } },
      )
    ).data;
  }
  const results = [];
  try {
    for (const [index, c] of chosen.entries()) {
      if (c.shortage) await h.setInventory('hq', 'NBS-MATOWA-100', 1);
      if (c.active)
        await stock.execute(h.users.legnicka, {
          type: 'SUBMIT',
          input: {
            salonId: h.legnickaId,
            items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
            idempotencyKey: randomUUID(),
          },
        });
      const before = await snapshot(),
        started = Date.now();
      let verdict: Record<string, unknown>;
      try {
        const result = await prepare(index < 6 ? h.users.legnicka : h.users.hq, {
          salonId: h.legnickaId,
          message: c.message,
        });
        const ready = result.lines
          .filter((l) => l.status === 'READY')
          .map((l) => [l.productId.split(':').at(-1), l.quantity])
          .sort();
        const expected = c.ready ? [...c.ready].sort() : undefined;
        verdict = {
          id: c.id,
          status: result.status,
          ready,
          unresolved: result.lines.filter((l) => l.status === 'NEEDS_CLARIFICATION').length,
          excluded: result.excluded.length,
          toolEvents: result.toolEvents,
          elapsedMs: Date.now() - started,
          passed:
            c.status.includes(result.status) &&
            (!expected || isDeepStrictEqual(ready, expected)) &&
            (!c.active || result.excluded.length === 1) &&
            (!c.shortage || result.lines.some((l) => l.status === 'READY' && l.hqAvailable === 1)),
        };
      } catch (error) {
        verdict = {
          id: c.id,
          passed: false,
          error: error instanceof Error ? error.message : 'UNKNOWN',
          elapsedMs: Date.now() - started,
        };
      }
      const unchanged = isDeepStrictEqual(await snapshot(), before);
      verdict.noStockWrites = unchanged;
      if (!unchanged) verdict.passed = false;
      results.push(verdict);
      if (c.shortage) await h.setInventory('hq', 'NBS-MATOWA-100', 18);
    }
    const report = {
      scope:
        'Real Vertex inference, synthetic isolated local SQL/Auth fixtures; not hosted App Check/runtime-SA proof',
      model: reasoning,
      results,
      passed: results.every((c) => c.passed === true),
      count: results.length,
    };
    await mkdir('artifacts/replenishment-eval', { recursive: true });
    await writeFile(
      `artifacts/replenishment-eval/${process.env.BARBERHQ_EVAL_CASE ?? 'report'}.json`,
      JSON.stringify(report, null, 2) + '\n',
    );
    if (!report.passed)
      throw Error(
        `Replenishment evaluation failed: ${results.filter((c) => c.passed !== true).length}/${report.count} cases; see artifacts/replenishment-eval`,
      );
    return report;
  } finally {
    await h.dispose();
  }
}
export const evaluateReplenishment = createAiRuntime(reasoning).defineFlow(
  { name: 'evaluateReplenishment' },
  run,
);
if (!process.argv.includes('--serve'))
  evaluateReplenishment()
    .then((result) => {
      process.stdout.write(JSON.stringify({ passed: result.passed, count: result.count }) + '\n');
      if (!result.passed) process.exitCode = 1;
    })
    .catch(() => {
      process.stderr.write(
        'Evaluation failed; check the explicit local target and provider access.\n',
      );
      process.exitCode = 1;
    });
