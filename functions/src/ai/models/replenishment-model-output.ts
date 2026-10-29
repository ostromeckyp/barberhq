import type { z } from 'genkit';
import type { replenishmentModelSchema } from '../replenishment-model.js';

export type ReplenishmentModelOutput = z.infer<typeof replenishmentModelSchema>;
