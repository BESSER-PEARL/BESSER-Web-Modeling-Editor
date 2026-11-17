#!/usr/bin/env node
/**
 * Type check ratchet: fails when the webapp project (which also type-checks
 * packages/editor under the webapp's settings) has MORE TypeScript errors than
 * the baseline. Run by CI and by `npm run typecheck`.
 *
 * Errors on develop: 350 when this check was added (300 of them in
 * packages/editor), 83 since the themed SVG shapes declare their colour props.
 * The count may only go down: lower BASELINE when you fix some.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASELINE = 83;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', 'packages/webapp/tsconfig.json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const errors = (result.stdout ?? '').split('\n').filter((line) => line.includes('error TS'));
console.log(`TypeScript errors: ${errors.length} (baseline ${BASELINE})`);

// A crash, a missing install or a config error (a diagnostic without a file position)
// means the project was not checked: never count that as "few errors".
const notChecked = errors.filter((line) => !/\(\d+,\d+\): error TS/.test(line));
if (result.error || notChecked.length > 0 || (result.status !== 0 && errors.length === 0)) {
  console.error([result.error?.message, result.stderr, ...notChecked].filter(Boolean).join('\n'));
  console.error(`::error::tsc could not type-check the project (exit ${result.status}).`);
  process.exit(1);
}
if (errors.length > BASELINE) {
  console.error(errors.slice(-50).join('\n'));
  console.error(`::error::${errors.length} TypeScript errors, more than the baseline of ${BASELINE}.`);
  process.exit(1);
}
if (errors.length < BASELINE) {
  console.log(`::notice::Down to ${errors.length} errors: lower BASELINE in scripts/typecheck.mjs.`);
}
