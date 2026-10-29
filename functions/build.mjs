import { cpSync } from 'node:fs';
cpSync(
  new URL('../scripts/generated/server', import.meta.url),
  new URL('./src/generated', import.meta.url),
  { recursive: true },
);
