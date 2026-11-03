import type {
  PrepareInput,
  ProposalResult,
  StockContext,
} from '../../../shared/contracts/ai/index.js';
import type { ClarificationLine } from '../../../shared/contracts/draft/index.js';
import { bindSourceLines } from './proposal.js';
import { lookupProducts } from './product-lookup.js';
import type { AppliedMatch } from './models/applied-match.js';
import type { FinalProposal } from './models/final-proposal.js';
import type { MatchRequest } from './models/match-request.js';
import type { ReplenishmentContext } from './models/replenishment-context.js';
import type { ReplenishmentProduct } from './models/replenishment-product.js';
import type { RequestedLine } from './models/requested-line.js';

export function stockOf(p: ReplenishmentProduct): StockContext {
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

/** The matcher's product knowledge, from the same scoped snapshot lookup uses. */
export function catalogCard(
  context: ReplenishmentContext,
  salonId: string,
): MatchRequest['catalog'] {
  const phrases = (productId: string, salon: boolean) => [
    ...new Set(
      context.aliases
        .filter((a) =>
          a.productId !== productId
            ? false
            : salon
              ? a.source === 'SALON_CONFIRMED' && a.salonId === salonId
              : a.source !== 'SALON_CONFIRMED' && a.salonId === null,
        )
        .map((a) => a.phrase),
    ),
  ];
  return context.products.map((p) => ({
    productId: p.productId,
    name: p.productName,
    type: p.type ?? '',
    category: p.category,
    keywords: p.keywords,
    aliases: phrases(p.productId, false),
    salonShorthand: phrases(p.productId, true),
  }));
}

const validQuantity = (q: number | null): q is number => Number.isInteger(q) && q! >= 1 && q! <= 99;

/** Verified lines from one snapshot; applied AI matches only re-label lines lookup left open. */
export function buildFinalProposal(
  input: PrepareInput,
  context: ReplenishmentContext,
  items: RequestedLine[],
  applied: AppliedMatch[] = [],
): FinalProposal {
  const { products } = context;
  const lines: ProposalResult['lines'] = [],
    excluded: ProposalResult['excluded'] = [],
    clarifications: FinalProposal['clarifications'] = [],
    choices: FinalProposal['choices'] = [],
    unresolved: FinalProposal['unresolved'] = [];
  const done = (status?: ProposalResult['status']): FinalProposal => ({
    result: {
      status:
        status ??
        (lines.some((l) => l.status === 'NEEDS_CLARIFICATION')
          ? 'NEEDS_CLARIFICATION'
          : lines.length
            ? 'PROPOSAL'
            : 'UNAVAILABLE'),
      lines,
      excluded,
      toolEvents: [],
    },
    clarifications,
    choices,
    unresolved,
    catalog: catalogCard(context, input.salonId),
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
  const byId = new Map(products.map((p) => [p.productId, p]));
  const matches = new Map(
    applied
      .filter((a) => a.candidates.length && a.candidates.every((c) => byId.has(c.productId)))
      .map((a) => [a.lineId, a]),
  );
  const plans = sourceLines.map((item) => {
    const lookup = item.selectedProductId
      ? null
      : lookupProducts(item.productQuery, products, context.aliases, input.salonId);
    const candidates = item.selectedProductId
      ? products.filter((p) => p.productId === item.selectedProductId)
      : lookup!.candidates.map((c) => byId.get(c.productId)!);
    // Only one unambiguous match or an explicit choice is READY; fallback never implies it.
    const found = !lookup || (!lookup.ambiguous && lookup.match !== 'NONE') ? candidates : [];
    // A client-supplied span carries no extracted phrase; only model extractions get receipts.
    const open =
      !!lookup &&
      found.length !== 1 &&
      !input.clarifications?.some((c) => c.lineId === item.lineId);
    const ai = open ? matches.get(item.lineId) : undefined;
    return { item, lookup, candidates, found, open, ai };
  });
  // Products several lines resolve to; an AI guess never merges into or hides another line.
  const resolved = plans.flatMap((p) =>
    p.ai?.outcome === 'READY'
      ? [p.ai.candidates[0].productId]
      : p.found.length === 1
        ? [p.found[0].productId]
        : [],
  );
  for (const { item, lookup, candidates, found, open, ai } of plans) {
    const quantity = validQuantity(item.quantity) ? item.quantity : null;
    if (open && !ai)
      unresolved.push({
        lineId: item.lineId,
        originalWording: item.originalWording,
        productQuery: item.productQuery,
        tier: lookup!.match,
        candidateIds: candidates.map((c) => c.productId),
        quantity: item.quantity,
      });
    if (ai) {
      const product = byId.get(ai.candidates[0].productId)!;
      const allowedProductIds = ai.candidates.map((c) => c.productId);
      clarifications.push({
        lineId: item.lineId,
        productQuery: item.productQuery,
        allowedProductIds,
      });
      if (
        ai.outcome === 'READY' &&
        quantity !== null &&
        !product.activeRequestId &&
        resolved.filter((id) => id === product.productId).length === 1
      ) {
        const { activeRequestId, ...stock } = stockOf(product);
        lines.push({
          ...stock,
          status: 'READY',
          lineId: item.lineId,
          quantity,
          origin: 'assistant',
          aiMatch: {
            originalWording: item.originalWording,
            reason: ai.reason,
            alternatives: ai.candidates
              .slice(1)
              .map(({ productId, productName }) => ({ productId, productName })),
          },
        });
        continue;
      }
      const enter = ai.outcome === 'ENTER_QUANTITY';
      lines.push({
        status: 'NEEDS_CLARIFICATION',
        lineId: item.lineId,
        originalWording: item.originalWording,
        origin: 'assistant',
        reason: enter ? 'Enter a whole quantity from 1 to 99.' : 'Choose a catalog product.',
        reasonCode: enter ? 'ENTER_QUANTITY' : 'CHOOSE_PRODUCT',
        candidates: ai.candidates,
        ...(quantity !== null ? { quantity } : {}),
      });
      continue;
    }
    if (found.length !== 1 || quantity === null) {
      const clarification: ClarificationLine = {
        status: 'NEEDS_CLARIFICATION',
        lineId: item.lineId,
        originalWording: item.originalWording,
        origin: 'assistant',
        reason:
          found.length !== 1 ? 'Choose a catalog product.' : 'Enter a whole quantity from 1 to 99.',
        reasonCode: found.length !== 1 ? 'CHOOSE_PRODUCT' : 'ENTER_QUANTITY',
        candidates: candidates.map(({ productId, productName }) => ({ productId, productName })),
        ...(quantity !== null ? { quantity } : {}),
        ...(item.choiceReceiptId ? { choiceReceiptId: item.choiceReceiptId } : {}),
      };
      lines.push(clarification);
      if (open)
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
    const existing = lines.find((l) => l.status === 'READY' && l.productId === product.productId);
    if (existing?.status === 'READY') existing.quantity += quantity;
    else {
      const { activeRequestId, ...stock } = stockOf(product);
      lines.push({ ...stock, status: 'READY', lineId: item.lineId, quantity, origin: 'assistant' });
    }
  }
  return done();
}
