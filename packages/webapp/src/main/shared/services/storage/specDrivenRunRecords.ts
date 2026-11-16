/**
 * What the browser remembers about a project's Spec-Driven Agent runs, read by
 * the spec-driven and GitHub features alike:
 *
 * - the project's last successful run, the base of the next modify run;
 * - the request the project's latest run was started with, in the user's words;
 * - the model each run started from (`runSeedModel`), so a later push can tell
 *   whether the canvas changed since and must not be replaced silently.
 */
import {
  localStorageSpecDrivenLastRunPrefix,
  localStorageSpecDrivenRunRequestPrefix,
  localStorageSpecDrivenRunSeedModels,
} from '../../constants/constant';
import { llmKeyRedactor } from '../llmKeyStorage';

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

/** Longest request text kept for a project. */
export const MAX_RUN_REQUEST_LENGTH = 4000;

const ORIGINAL_REQUEST_HEADING = "## The user's original request, verbatim";

/** Paragraphs the assistant adds to frame the user's words; not the user's. */
const FRAMING_PARAGRAPH = /^(## |This is the authority\b|This later request takes precedence\b)/;

/**
 * The user's own words in a run's instructions. The assistant frames them as
 * "## Assistant's notes ...", then "## The user's original request, verbatim"
 * with the original description and any "## Subsequent user request,
 * verbatim" sections it appended. The notes, that heading and its one framing
 * sentence are dropped, so what is kept is what the assistant remembers as the
 * application's request. Cut to MAX_RUN_REQUEST_LENGTH.
 */
export function runRequestFromInstructions(instructions: string): string {
  const text = instructions.trim();
  const start = text.startsWith("## Assistant's notes") ? text.indexOf(ORIGINAL_REQUEST_HEADING) : -1;
  if (start < 0) return text.slice(0, MAX_RUN_REQUEST_LENGTH);
  const [first, ...rest] = text.slice(start + ORIGINAL_REQUEST_HEADING.length).trim().split(/\n\s*\n/);
  const body = FRAMING_PARAGRAPH.test(first) ? rest : [first, ...rest];
  return body.join('\n\n').trim().slice(0, MAX_RUN_REQUEST_LENGTH);
}

/** Words that ask for a run without describing anything ("regenerate with fixes", "try again"). */
const CONTENT_FREE_WORDS = new Set([
  'a', 'again', 'all', 'an', 'and', 'anyway', 'app', 'application', 'build', 'code', 'continue', 'current',
  'do', 'fix', 'fixed', 'fixes', 'for', 'generate', 'generation', 'go', 'it', 'model', 'my', 'now', 'ok',
  'okay', 'one', 'please', 'rebuild', 'redo', 'regenerate', 'rerun', 'restart', 'retry', 'run', 'same',
  'start', 'that', 'the', 'this', 'time', 'to', 'try', 'with', 'yes',
]);

/** True when the user's words in `request` describe nothing about the application. */
export function isContentFreeRequest(request: string): boolean {
  const words = request
    .split(/\n\s*\n/)
    .filter((paragraph) => !FRAMING_PARAGRAPH.test(paragraph.trim()))
    .join(' ')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.every((word) => CONTENT_FREE_WORDS.has(word));
}

const runRequestKey = (projectId: string): string => `${localStorageSpecDrivenRunRequestPrefix}${projectId}`;

/** The request the project's latest run was started with, or null. */
export function readProjectRunRequest(projectId: string): string | null {
  if (!projectId) return null;
  try {
    const request = window.localStorage.getItem(runRequestKey(projectId));
    return request ? request.slice(0, MAX_RUN_REQUEST_LENGTH) : null;
  } catch {
    return null;
  }
}

/**
 * Remember the request a run is started with, as the user's words (see
 * `runRequestFromInstructions`), a pasted key removed. Instructions that
 * describe nothing leave the previous request in place.
 */
export function recordProjectRunRequest(projectId: string, instructions: string): void {
  const request = runRequestFromInstructions(instructions);
  if (!projectId || isContentFreeRequest(request)) return;
  try {
    window.localStorage.setItem(runRequestKey(projectId), llmKeyRedactor()(request).slice(0, MAX_RUN_REQUEST_LENGTH));
  } catch {
    /* ignore */
  }
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

// Pushes come from recent run cards; older runs fall back to asking the user.
const MAX_RUN_SEED_MODELS = 20;

/** What a run started from, beyond the model's exact fingerprint. */
export interface RunSeedContext {
  /** The commit the project's link was at. */
  baseCommitSha?: string;
  /** `modelContentFingerprint` of the model. */
  content?: string;
}

type RunSeedEntry = [string, string, RunSeedContext?];

const readRunSeedModels = (): RunSeedEntry[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(localStorageSpecDrivenRunSeedModels) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((e): e is RunSeedEntry => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string')
      : [];
  } catch {
    return [];
  }
};

/** Remember the fingerprint (`modelFingerprint`) of the model run `runId` started from. */
export function recordRunSeedModel(runId: string, fingerprint: string, context?: RunSeedContext): void {
  if (!isValidRunId(runId)) return;
  const entries = readRunSeedModels().filter(([id]) => id !== runId);
  entries.push(context ? [runId, fingerprint, context] : [runId, fingerprint]);
  try {
    window.localStorage.setItem(localStorageSpecDrivenRunSeedModels, JSON.stringify(entries.slice(-MAX_RUN_SEED_MODELS)));
  } catch {
    /* ignore */
  }
}

/** The fingerprint of the model run `runId` started from, or null when it is not known. */
export function readRunSeedModel(runId: string): string | null {
  return readRunSeedModels().find(([id]) => id === runId)?.[1] ?? null;
}

/** What run `runId` started from, besides its fingerprint; empty when it is not known. */
export function readRunSeed(runId: string): RunSeedContext {
  return readRunSeedModels().find(([id]) => id === runId)?.[2] ?? {};
}
