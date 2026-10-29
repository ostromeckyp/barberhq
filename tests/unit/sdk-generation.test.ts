import { expect, it } from 'vitest';
import { sdkGenerationCommand } from '../../scripts/config/generate-sdk.mjs';
it('refuses_missing_project_before_any_cli_execution', () => {
  expect(() => sdkGenerationCommand([])).toThrow(/explicit.*--project/i);
});
it('passes_exact_explicit_local_project_to_cli', () => {
  expect(sdkGenerationCommand(['--project', 'demo-barberhq']).slice(1)).toEqual([
    'dataconnect:sdk:generate',
    '--project',
    'demo-barberhq',
  ]);
});
it.each([
  ['--project'],
  ['--project', ''],
  ['--project', 'demo-barberhq', '--project', 'other'],
  ['--unknown', 'demo-barberhq'],
])('rejects_ambiguous_cli_arguments_%j', (...args) => {
  expect(() =>
    sdkGenerationCommand(args.filter((a): a is string => typeof a === 'string')),
  ).toThrow();
});
