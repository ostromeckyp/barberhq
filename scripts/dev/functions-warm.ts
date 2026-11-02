import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface WarmTarget {
  name: string;
  url: string;
  method: 'POST' | 'GET';
}

export function warmTargets(project: string, region: string): WarmTarget[] {
  const base = `https://${region}-${project}.cloudfunctions.net`;
  return [
    { name: 'commands', url: `${base}/commands`, method: 'POST' },
    { name: 'ai', url: `${base}/ai`, method: 'POST' },
    { name: 'getSourcePdf', url: `${base}/getSourcePdf`, method: 'GET' },
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const targets = warmTargets('notbad-6be95', 'europe-west1');
  let failed = false;
  for (const target of targets) {
    const started = Date.now();
    try {
      const response = await fetch(target.url, {
        method: target.method,
        ...(target.method === 'POST'
          ? { headers: { 'content-type': 'application/json' }, body: '{"data":{}}' }
          : {}),
      });
      console.log(`${target.name} ${response.status} ${Date.now() - started}ms`);
    } catch (error) {
      failed = true;
      console.log(`${target.name} error ${Date.now() - started}ms ${String(error)}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
