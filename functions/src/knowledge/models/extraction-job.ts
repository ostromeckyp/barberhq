import type { z } from 'zod';
import type { jobSchema } from '../worker.js';

export type ExtractionJob = z.infer<typeof jobSchema>;
