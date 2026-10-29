import type { StructuredGenerationOptions } from './structured-generation-options.js';

export type StructuredGenerationProvider = (
  options: StructuredGenerationOptions,
) => Promise<{ output: unknown }>;
