import { z } from 'genkit';
import type { PrepareInput, ProcedureInput } from '../../../shared/contracts/ai/index.js';
import { AiError } from './budget.js';
import type { ProcedureModelOutput } from './models/procedure-model-output.js';

const boundedText = z
  .string()
  .refine((value) => Boolean(value.trim()) && [...value].length <= 2000);
const identifier = z.string().min(1).max(200);
const clarification = z
  .object({
    lineId: identifier,
    originalWording: boundedText,
    productId: identifier.optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    choiceReceiptId: z.string().min(1).max(64).optional(),
  })
  .strict();

const prepare = z
  .object({
    salonId: identifier,
    message: boundedText,
    clarifications: z.array(clarification).max(6).optional(),
  })
  .strict();

const procedure = z
  .object({ question: boundedText, answerLanguage: z.enum(['en', 'pl']) })
  .strict();

export function parsePrepareInput(input: unknown): PrepareInput {
  const result = prepare.safeParse(input);
  if (!result.success) throw new AiError('VALIDATION_ERROR');
  return result.data;
}
export function parseProcedureInput(input: unknown): ProcedureInput {
  const result = procedure.safeParse(input);
  if (!result.success) throw new AiError('VALIDATION_ERROR');
  return result.data;
}

const citedStep = z
  .object({
    text: z.string().trim().min(1).max(2000),
    sourceSectionIds: z.array(identifier).min(1).max(3),
  })
  .strict();
export const procedureModelSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('ANSWER'),
      steps: z.array(citedStep).min(1).max(8),
      missingInformation: z.array(boundedText).max(5),
    })
    .strict(),
  z.object({ status: z.literal('MISSING_CONTEXT'), searchQuery: boundedText }).strict(),
  z.object({ status: z.literal('NEEDS_CLARIFICATION'), question: boundedText }).strict(),
  z.object({ status: z.literal('INSUFFICIENT_EVIDENCE'), message: boundedText }).strict(),
]);
export function parseProcedureModelOutput(raw: unknown): ProcedureModelOutput {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new AiError('INVALID_MODEL_OUTPUT');
    }
  }
  const result = procedureModelSchema.safeParse(value);
  if (!result.success) throw new AiError('INVALID_MODEL_OUTPUT');
  return result.data;
}
