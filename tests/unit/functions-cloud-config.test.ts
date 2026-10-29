import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (name === 'generated') return [];
    return statSync(file).isDirectory() ? sources(file) : file.endsWith('.ts') ? [file] : [];
  });
}

describe('Functions cloud config', () => {
  it('matches the operator cloud config', () => {
    const functions = json('functions/config/cloud.json');
    const operator = json('config/knowledge-cloud.json');
    expect(functions).toEqual({
      projectId: operator.projectId,
      sqlService: operator.dataConnect.serviceId,
      sqlLocation: operator.dataConnect.location,
      bucket: operator.firebaseStorageBucket,
      vertexAi: operator.vertexAi,
      allowedOrigins: [
        'https://notbad-6be95.web.app',
        'https://notbad-6be95.firebaseapp.com',
        'https://notbad-6be95--foundation-unesffgt.web.app',
      ],
    });
  });

  it('deploys without interactive parameters', () => {
    const withParams = sources('functions/src').filter((file) =>
      readFileSync(file, 'utf8').includes('firebase-functions/params'),
    );
    expect(withParams).toEqual([]);
  });
});
