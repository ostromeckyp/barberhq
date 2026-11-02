import type { commandOps } from './command-ops.js';

export type CommandOp = (typeof commandOps)[number];
