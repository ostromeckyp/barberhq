import { describe, expect, it } from 'vitest';
import { warmLine, warmTargets } from '../../scripts/dev/functions-warm.ts';
import {
  describeCommand,
  instancesCommands,
  minScaleLine,
} from '../../scripts/dev/functions-instances.ts';

describe('functions warm-up targets', () => {
  it('lists commands and ai as POST and getSourcePdf as GET', () => {
    expect(warmTargets('notbad-6be95', 'europe-west1')).toEqual([
      {
        name: 'commands',
        url: 'https://europe-west1-notbad-6be95.cloudfunctions.net/commands',
        method: 'POST',
      },
      {
        name: 'ai',
        url: 'https://europe-west1-notbad-6be95.cloudfunctions.net/ai',
        method: 'POST',
      },
      {
        name: 'getSourcePdf',
        url: 'https://europe-west1-notbad-6be95.cloudfunctions.net/getSourcePdf',
        method: 'GET',
      },
    ]);
  });
});

describe('functions min-instances commands', () => {
  it('builds one gcloud update per service', () => {
    const base = ['--min-instances', '1', '--region', 'europe-west1'];
    const tail = ['--project', 'notbad-6be95', '--quiet'];
    expect(instancesCommands(1, 'notbad-6be95', 'europe-west1')).toEqual(
      ['commands', 'ai', 'getsourcepdf'].map((svc) => [
        'gcloud',
        'run',
        'services',
        'update',
        svc,
        ...base,
        ...tail,
      ]),
    );
  });

  it('accepts 0 and 3', () => {
    expect(instancesCommands(0, 'p', 'r')).toHaveLength(3);
    expect(instancesCommands(3, 'p', 'r')[0]).toContain('3');
  });

  it.each([-1, 4, 1.5, Number.NaN])('rejects %s', (n) => {
    expect(() => instancesCommands(n, 'p', 'r')).toThrow();
  });
});

describe('functions script output', () => {
  it('labels min scale lines and maps empty to 0', () => {
    expect(minScaleLine('commands', '1\n')).toBe('commands: 1');
    expect(minScaleLine('ai', '\n')).toBe('ai: 0');
  });

  it('builds the describe argv', () => {
    expect(describeCommand('ai', 'p', 'r').slice(0, 5)).toEqual([
      'gcloud',
      'run',
      'services',
      'describe',
      'ai',
    ]);
  });

  it('formats warm lines including timeout', () => {
    expect(warmLine('commands', 401, 12)).toBe('commands 401 12ms');
    expect(warmLine('ai', 'timeout', 60000)).toBe('ai timeout 60000ms');
    expect(warmLine('ai', 'error', 5, 'boom')).toBe('ai error 5ms boom');
  });
});
