import type {
  StockContext,
  PrepareInput,
  ProposalResult,
} from '../../../shared/contracts/ai/index.js';
import type { ProductMatch } from '../../../shared/contracts/product-lookup/index.js';
import type { ClarificationLine } from '../../../shared/contracts/draft/index.js';
import type { ActorContext } from './models/actor-context.js';
import { AiError, consumeToolCall, runWithinBudget } from './budget.js';
import type { AiBudget } from './models/ai-budget.js';
import { bindSourceLines } from './proposal.js';
import type { RequestedLine } from './models/requested-line.js';
import { lookupProducts } from './product-lookup.js';
import type { ReplenishmentProduct } from './models/replenishment-product.js';
import type { ReplenishmentContext } from './models/replenishment-context.js';
import type { ReplenishmentRepository } from './models/replenishment-repository.js';
import type { FinalProposal } from './models/final-proposal.js';
function stockOf(p: ReplenishmentProduct): StockContext {
  const {
    productId,
    productName,
    hqAvailable,
    salonOnHand,
    hqInventoryVersion,
    salonInventoryVersion,
    activeRequestId,
  } = p;
  return {
    productId,
    productName,
    hqAvailable,
    salonOnHand,
    hqInventoryVersion,
    salonInventoryVersion,
    activeRequestId,
  };
}
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
  /** Final validation plus the facts the preparer needs for receipts and learning. */
  async function finalProposal(items: RequestedLine[]): Promise<FinalProposal> {
    const final = await call('calculateProposal', async () => {
      const context = await read();
      const { products } = context;
      const lines: ProposalResult['lines'] = [],
        excluded: ProposalResult['excluded'] = [],
        clarifications: FinalProposal['clarifications'] = [],
        choices: FinalProposal['choices'] = [];
      const done = (status?: ProposalResult['status']) => ({
        result: {
          status:
            status ??
            (lines.some((l) => l.status === 'NEEDS_CLARIFICATION')
              ? ('NEEDS_CLARIFICATION' as const)
              : lines.length
                ? ('PROPOSAL' as const)
                : ('UNAVAILABLE' as const)),
          lines,
          excluded,
        },
        clarifications,
        choices,
        catalogRevision: context.catalogRevision,
      });
      // The batch-limit guard is not a product match and gets no learning receipt.
      if (items.length > 6) {
        lines.push({
          status: 'NEEDS_CLARIFICATION',
          lineId: `line-0-${input.message.length}`,
          originalWording: input.message,
          reason: 'Prepare up to six items at a time. No items were discarded.',
          reasonCode: 'BATCH_LIMIT',
          origin: 'assistant',
          candidates: [],
        });
        return done('NEEDS_CLARIFICATION');
      }
      const sourceLines = bindSourceLines(input, items);
      if (!products.length) return done('UNAVAILABLE');
      for (const item of sourceLines) {
        const lookup = item.selectedProductId ? null : match(item.productQuery, context);
        const candidates = item.selectedProductId
          ? products.filter((p) => p.productId === item.selectedProductId)
          : lookup!.candidates.map((c) => products.find((p) => p.productId === c.productId)!);
        // Only one unambiguous match or an explicit choice is READY; fallback never implies it.
        const found = !lookup || (!lookup.ambiguous && lookup.match !== 'NONE') ? candidates : [];
        const validQuantity =
          Number.isInteger(item.quantity) && item.quantity! >= 1 && item.quantity! <= 99;
        if (found.length !== 1 || !validQuantity) {
          const clarification: ClarificationLine = {
            status: 'NEEDS_CLARIFICATION',
            lineId: item.lineId,
            originalWording: item.originalWording,
            origin: 'assistant',
            reason:
              found.length !== 1
                ? 'Choose a catalog product.'
                : 'Enter a whole quantity from 1 to 99.',
            reasonCode: found.length !== 1 ? 'CHOOSE_PRODUCT' : 'ENTER_QUANTITY',
            candidates: candidates.map(({ productId, productName }) => ({
              productId,
              productName,
            })),
            ...(validQuantity ? { quantity: item.quantity! } : {}),
            ...(item.choiceReceiptId ? { choiceReceiptId: item.choiceReceiptId } : {}),
          };
          lines.push(clarification);
          // A client-supplied span carries no extracted phrase; only model extractions get receipts.
          if (
            lookup &&
            found.length !== 1 &&
            !input.clarifications?.some((c) => c.lineId === item.lineId)
          )
            clarifications.push({
              lineId: item.lineId,
              productQuery: item.productQuery,
              allowedProductIds: candidates.map((c) => c.productId),
            });
          continue;
        }
        const product = found[0];
        if (item.selectedProductId)
          choices.push({
            lineId: item.lineId,
            productId: product.productId,
            ...(item.choiceReceiptId ? { choiceReceiptId: item.choiceReceiptId } : {}),
          });
        if (product.activeRequestId) {
          if (!excluded.some((e) => e.productId === product.productId))
            excluded.push({
              lineId: item.lineId,
              productId: product.productId,
              requestId: product.activeRequestId,
              reason: 'ALREADY_ACTIVE',
            });
          continue;
        }
        const existing = lines.find(
          (l) => l.status === 'READY' && l.productId === product.productId,
        );
        if (existing?.status === 'READY') existing.quantity += item.quantity!;
        else {
          const { activeRequestId, ...stock } = stockOf(product);
          lines.push({
            ...stock,
            status: 'READY',
            lineId: item.lineId,
            quantity: item.quantity!,
            origin: 'assistant',
          });
        }
      }
      return done();
    });
    return { ...final, result: { ...final.result, toolEvents: [...events] } };
  }
  async function calculateProposal(items: RequestedLine[]): Promise<ProposalResult> {
    return (await finalProposal(items)).result;
  }
  return { findProduct, getStockContext, calculateProposal, finalProposal };
}
