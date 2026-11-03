import type {
  StockContext,
  PrepareInput,
  ProposalResult,
} from '../../../shared/contracts/ai/index.js';
import type { ProductMatch } from '../../../shared/contracts/product-lookup/index.js';
import type { ActorContext } from './models/actor-context.js';
import { AiError, consumeToolCall, runWithinBudget } from './budget.js';
import type { AiBudget } from './models/ai-budget.js';
import { buildFinalProposal, stockOf } from './replenishment-final.js';
import type { RequestedLine } from './models/requested-line.js';
import { lookupProducts } from './product-lookup.js';
import type { AppliedMatch } from './models/applied-match.js';
import type { ReplenishmentContext } from './models/replenishment-context.js';
import type { ReplenishmentRepository } from './models/replenishment-repository.js';
import type { FinalProposal } from './models/final-proposal.js';
export function createReplenishmentTools(options: {
  actor: ActorContext;
  input: PrepareInput;
  budget: AiBudget;
  repository: ReplenishmentRepository;
}) {
  const { actor, input, budget, repository } = options;
  const events: ProposalResult['toolEvents'] = [];
  async function read() {
    if (actor.role === 'SALON' && !actor.salonIds.includes(input.salonId))
      throw new AiError('FORBIDDEN');
    return repository.readContext(actor, input.salonId, budget);
  }
  async function call<T>(
    name: ProposalResult['toolEvents'][number]['name'],
    work: () => Promise<T>,
  ): Promise<T> {
    consumeToolCall(budget);
    const began = Date.now();
    const result = await runWithinBudget(budget, work);
    events.push({ name, durationMs: Date.now() - began });
    return result;
  }
  function match(query: string, context: ReplenishmentContext): ProductMatch {
    return lookupProducts(query, context.products, context.aliases, input.salonId);
  }
  function bounded(values: string[]) {
    if (
      values.length < 1 ||
      values.length > 6 ||
      values.some((v) => typeof v !== 'string' || !v.trim() || v.length > 2000)
    )
      throw new AiError('VALIDATION_ERROR');
  }
  async function findProduct(queries: string[]): Promise<ProductMatch[]> {
    bounded(queries);
    return call('findProduct', async () => {
      const context = await read();
      return queries.map((query) => match(query, context));
    });
  }
  async function getStockContext(productIds: string[]): Promise<StockContext[]> {
    bounded(productIds);
    return call('getStockContext', async () => {
      const { products } = await read();
      if (productIds.some((id) => !products.some((p) => p.productId === id)))
        throw new AiError('FORBIDDEN');
      return products.filter((p) => productIds.includes(p.productId)).map(stockOf);
    });
  }
  /** Snapshot of the last final read; an AI re-label reuses it instead of reading again. */
  let snapshot: ReplenishmentContext | undefined;
  /**
   * Final validation plus the facts the preparer needs for receipts, learning and matching.
   * Without `applied` it re-reads scope, catalog and stock; with `applied` it rebuilds the same
   * snapshot, so the AI step adds no read and no tool call.
   */
  async function finalProposal(
    items: RequestedLine[],
    applied?: AppliedMatch[],
  ): Promise<FinalProposal> {
    const final =
      applied && snapshot
        ? buildFinalProposal(input, snapshot, items, applied)
        : await call('calculateProposal', async () => {
            snapshot = await read();
            return buildFinalProposal(input, snapshot, items, applied);
          });
    return { ...final, result: { ...final.result, toolEvents: [...events] } };
  }
  async function calculateProposal(items: RequestedLine[]): Promise<ProposalResult> {
    return (await finalProposal(items)).result;
  }
  return { findProduct, getStockContext, calculateProposal, finalProposal };
}
