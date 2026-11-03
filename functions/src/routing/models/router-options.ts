import type { LogSeverity } from '../../logging/models/log-severity.js';

export type RouterOptions = {
  service: 'commands' | 'ai';
  log?: (severity: LogSeverity, entry: Record<string, unknown>) => void;
};
