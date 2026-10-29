import type { GenerationOptions } from './generation-options.js';

export type GenerationProvider = (options: GenerationOptions) => Promise<{ text: string }>;
