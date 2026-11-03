import type { LogSeverity } from './log-severity.js';

export type ClientLogDeps = {
  origins: string[];
  verifyAuth(token: string): Promise<string | null>;
  write(severity: LogSeverity, entry: Record<string, unknown>): void;
};
