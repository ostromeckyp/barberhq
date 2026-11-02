import './setup.js';
import { sourcePdfFunction } from './knowledge/source.js';
import { uploadKnowledgePdfFunction } from './knowledge/upload.js';
import { processKnowledgeTaskFunction } from './knowledge/worker.js';
import { ai as aiService } from './routing/ai.js';
import { commands as commandsService } from './routing/commands.js';

// User-facing callables are merged into two services, dispatched by `{ op, input }`.
export const commands = commandsService;
export const ai = aiService;

export const getSourcePdf = sourcePdfFunction();
export const uploadKnowledgePdf = uploadKnowledgePdfFunction();
export const processKnowledgeTask = processKnowledgeTaskFunction();
