import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const hook = '.agents/hooks/block-secret-files.py';
const run = (tool_name: string, tool_input: Record<string, string>) =>
  spawnSync('python3', [hook], { input: JSON.stringify({ tool_name, tool_input }) }).status;
const bash = (command: string) => run('Bash', { command });

describe('secret files hook', () => {
  it.each([
    'cat .env',
    'cat functions/.env.notbad-6be95',
    'head -5 .env.e2e',
    "grep TOKEN '.env.e2e'",
    'cp .env /tmp/x',
    'cat .env*',
    'cat config/public.local.json',
    'git show HEAD:config/memberships.local.json',
  ])('blocks a shell read: %s', (command) => {
    expect(bash(command)).toBe(2);
  });

  it.each([
    'cat .env.example',
    'cat .env.sample',
    "grep -q '^TOKEN=' .env.e2e && echo set",
    'test -f .env.e2e && echo present',
    'node -e "console.log(process.env.HOME)"',
    'grep -rn import.meta.env web/src',
    'npm run test:e2e',
    'node --import tsx scripts/config/build-web.ts --config config/public.local.json --project p',
  ])('allows: %s', (command) => {
    expect(bash(command)).toBe(0);
  });

  it('blocks Claude file tools on .env files and allows the templates', () => {
    expect(run('Read', { file_path: '/repo/.env' })).toBe(2);
    expect(run('Read', { file_path: '/repo/.env.e2e' })).toBe(2);
    expect(run('Edit', { file_path: '/repo/functions/.env.notbad-6be95' })).toBe(2);
    expect(run('Grep', { pattern: 'TOKEN', path: '.env.e2e' })).toBe(2);
    expect(run('Glob', { pattern: '**/.env*' })).toBe(2);
    expect(run('Read', { file_path: '/repo/.env.example' })).toBe(0);
    expect(run('Read', { file_path: '/repo/web/src/environment.ts' })).toBe(0);
    expect(run('Grep', { pattern: '\\.env', path: 'docs' })).toBe(0);
  });

  it('blocks Codex patches that touch .env files', () => {
    const patch = (path: string) => `*** Begin Patch\n*** Update File: ${path}\n*** End Patch`;
    expect(run('apply_patch', { command: patch('.env.e2e') })).toBe(2);
    expect(run('apply_patch', { command: patch('.env.example') })).toBe(0);
    expect(run('apply_patch', { command: patch('docs/commands.md') })).toBe(0);
  });
});
