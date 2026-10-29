/**
 * What the browser remembers about a project's Spec-Driven Agent runs, read by
 * the spec-driven and GitHub features alike:
 *
 * - the project's last successful run, the base of the next modify run;
 * - the model each run started from (`runSeedModel`), so a later push can tell
 *   whether the canvas changed since and must not be replaced silently.
 */
import { localStorageSpecDrivenLastRunPrefix, localStoragePrefix } from '../../constants/constant';

/** Canonical backend run id: `uuid.uuid4().hex` → 32 lowercase hex chars. */
const RUN_ID_RE = /^[a-f0-9]{32}$/i;

/** Narrow an arbitrary value to a valid 32-hex run id. */
export function isValidRunId(value: unknown): value is string {
  return typeof value === 'string' && RUN_ID_RE.test(value);
}

/** A previously recorded successful run for a project. */
export interface LastRunRecord {
  runId: string;
  /** Epoch ms at which the run completed. */
  at: number;
}

const lastRunKey = (projectId: string): string => `${localStorageSpecDrivenLastRunPrefix}${projectId}`;

/**
 * Read the stored last successful run for a project, or `null` when none
 * / unusable. Validates the run id (32-hex) and timestamp so a corrupted
 * or hand-edited entry degrades to "no last run" (a fresh build) rather
 * than sending a bad `base_run_id`.
 */
export function readProjectLastRun(projectId: string): LastRunRecord | null {
  if (!projectId) return null;
  try {
    const raw = window.localStorage.getItem(lastRunKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastRunRecord> | null;
    if (!parsed || !isValidRunId(parsed.runId)) return null;
    const at = typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0;
    return { runId: parsed.runId, at };
  } catch {
    return null;
  }
}

/** Persist the last successful run for a project. No-op on failure. */
export function writeProjectLastRun(projectId: string, runId: string, at: number): void {
  if (!projectId || !isValidRunId(runId)) return;
  try {
    window.localStorage.setItem(lastRunKey(projectId), JSON.stringify({ runId, at }));
  } catch {
    /* ignore */
  }
}

const RUN_SEED_MODELS_KEY = `${localStoragePrefix}smartgen_run_seed_models`;
// Pushes come from recent run cards; older runs fall back to asking the user.
const MAX_RUN_SEED_MODELS = 20;

const readRunSeedModels = (): [string, string][] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RUN_SEED_MODELS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string')
      : [];
  } catch {
    return [];
  }
};

/** Remember the fingerprint (`modelFingerprint`) of the model run `runId` started from. */
export function recordRunSeedModel(runId: string, fingerprint: string): void {
  if (!isValidRunId(runId)) return;
  const entries = readRunSeedModels().filter(([id]) => id !== runId);
  entries.push([runId, fingerprint]);
  try {
    window.localStorage.setItem(RUN_SEED_MODELS_KEY, JSON.stringify(entries.slice(-MAX_RUN_SEED_MODELS)));
  } catch {
    /* ignore */
  }
}

/** The fingerprint of the model run `runId` started from, or null when it is not known. */
export function readRunSeedModel(runId: string): string | null {
  return readRunSeedModels().find(([id]) => id === runId)?.[1] ?? null;
}
