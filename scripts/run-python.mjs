// Run a Python script with whichever interpreter is on PATH: `python3` on
// Linux/macOS (where `python` is often missing), `python` first on Windows
// (where `python3` can be the Microsoft Store stub).
// Usage: node scripts/run-python.mjs SCRIPT.py [ARGS...]
import { spawnSync } from 'node:child_process';

const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
for (const command of candidates) {
  const result = spawnSync(command, process.argv.slice(2), { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') continue;
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
console.error(`run-python: none of ${candidates.join(', ')} is on PATH.`);
process.exit(1);
