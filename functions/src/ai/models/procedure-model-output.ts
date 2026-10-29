import type { z } from 'genkit';
import type { procedureModelSchema } from '../schemas.js';

export type ProcedureModelOutput = z.infer<typeof procedureModelSchema>;
