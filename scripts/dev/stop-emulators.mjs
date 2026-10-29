/** Stops local Firebase emulators, including emulator binaries orphaned by a crashed launcher. */
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// Skips npm/npx wrappers: they forward signals, and a second SIGINT can abort the export.
const LAUNCHER = /^(?!npm |npx )\S*\bnode\b.*\bfirebase\b.*\bemulators:(start|exec)\b/;
const BINARY = /\.cache\/firebase\/emulators\//;

function find(pattern) {
  const out = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
    .filter((m) => m && Number(m[1]) !== process.pid && pattern.test(m[2]))
    .map((m) => Number(m[1]));
}

function signal(pids, sig) {
  for (const pid of pids) {
    try {
      process.kill(pid, sig);
    } catch {
      // Already exited.
    }
  }
}

async function waitFor(pattern, ms) {
  for (let waited = 0; waited < ms; waited += 500) {
    if (find(pattern).length === 0) return true;
    await sleep(500);
  }
  return false;
}

const launchers = find(LAUNCHER);
const binaries = find(BINARY);
if (launchers.length + binaries.length === 0) {
  console.log('No emulators running.');
  process.exit(0);
}

// SIGINT lets the CLI finish --export-on-exit before shutting down.
signal(launchers, 'SIGINT');
if (!(await waitFor(LAUNCHER, 30_000))) signal(find(LAUNCHER), 'SIGKILL');

signal(find(BINARY), 'SIGTERM');
if (!(await waitFor(BINARY, 5_000))) signal(find(BINARY), 'SIGKILL');

console.log(`Stopped ${launchers.length} launcher(s), ${binaries.length} emulator process(es).`);
