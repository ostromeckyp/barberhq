import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { parseProductAliasGeneration } from '../../functions/src/knowledge/product-knowledge-schemas.js';
import { calculateAliasImpact } from '../../functions/src/knowledge/product-knowledge-rules.js';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--fixture')
  throw new Error(
    'Fixture mode requires --fixture PATH. Live provider evaluation is a separate approved release gate.',
  );
const fixture = z
  .strictObject({
    label: z.string(),
    cases: z.array(z.strictObject({ productId: z.string(), output: z.unknown() })).min(1),
  })
  .parse(JSON.parse(await readFile(args[1], 'utf8')));
const proposals = fixture.cases.flatMap((c) =>
  parseProductAliasGeneration(c.output).aliases.map((a, i) => ({
    ...a,
    id: `${c.productId}:${i}`,
    productId: c.productId,
    source: 'generated' as const,
    decision: 'accepted' as const,
  })),
);
const impact = calculateAliasImpact(proposals, []);
if (!proposals.length || impact.some((i) => i.afterProductIds.length === 0))
  throw new Error('Invalid fixture impact');
console.log(
  JSON.stringify({
    mode: 'fixture-only',
    cases: fixture.cases.length,
    proposals: proposals.length,
    impacts: impact.length,
    providerQuality: 'unmeasured',
    cloudCalls: 0,
  }),
);
