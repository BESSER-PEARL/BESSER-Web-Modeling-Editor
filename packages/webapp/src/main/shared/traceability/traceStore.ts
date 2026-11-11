import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import i18n from '../i18n';
import { reportError } from '../services/errors/reportError';
import { readLegacyTrace, removeLegacyTrace } from '../services/storage/legacyTraceStorage';
import type { BesserProject, ProjectDiagram } from '../types/project';
import { emptyTraceFile, TRACE_SCHEMA_VERSION } from '../types/traceability';
import type { RequirementArtifact, TraceFile } from '../types/traceability';
import { diffClassModel } from './classModelDiff';
import type { ClassModelLike, ElementChange } from './classModelDiff';
import { indexedDbTraceStorage, memoryTraceStorage } from './traceDatabase';
import type { TraceStorage } from './traceDatabase';
import {
  endConversation,
  findModelArtifact,
  mergeTraceFragment,
  pruneStoredContents,
  recordConversationReply,
  recordConversationRequest,
  recordElementChanges,
} from './traceRecorder';
import { migrateTraceFile } from './traceMigration';
import { latestRequirements } from './traceQueries';
import { readAssistantRequirements, requestStating } from './assistantRequirements';
import type { AssistantRequirements } from './assistantRequirements';
import type { AssistantReplyKind, AssistantRequest, ModelingSource } from './traceRecorder';

/**
 * The project trace, kept in the browser's IndexedDB (`traceDatabase.ts`), apart from the project
 * itself (`besser_project_<projectId>` in `localStorage`), and exported with the project when the
 * user ticks it in the Export dialog (the `trace` of the JSON envelope, the TRACEABILITY section of
 * the B-UML file).
 *
 * A trace is loaded once per session and then kept in memory: views read it from there, updates
 * apply to it at once (or, before it has loaded, in order once it has), and it is saved in the
 * background, a short while after the last update and when the page is hidden.
 *
 * Recording is per project (`settings.traceabilityEnabled`): on for a new project, off when unset.
 */

/** Recorded when the project has no owner. Mirrors `TRACE_ANONYMOUS_ACTOR` in the backend. */
export const ANONYMOUS_ACTOR = 'anonymous';
/** Updates this close together are saved in one write (typing a name updates the trace on every key). */
export const SAVE_DELAY_MS = 300;

let storage: TraceStorage = defaultStorage();
const cache = new Map<string, TraceFile>();
const loading = new Map<string, Promise<TraceFile>>();
const unsaved = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function defaultStorage(): TraceStorage {
  if (typeof indexedDB !== 'undefined') return indexedDbTraceStorage();
  console.warn('This browser has no IndexedDB: project traces are kept for this session only.');
  return memoryTraceStorage();
}

/** Use another storage (tests); forgets every loaded trace. */
export function setTraceStorage(next: TraceStorage): void {
  storage = next;
  cache.clear();
  loading.clear();
  unsaved.forEach(clearTimeout);
  unsaved.clear();
}

const notify = () => listeners.forEach((listener) => listener());

export const isTraceabilityEnabled = (project: BesserProject | null | undefined): boolean =>
  project?.settings?.traceabilityEnabled === true;

export const traceActorName = (project: BesserProject): string => project.owner?.trim() || ANONYMOUS_ACTOR;

/** Why a trace file cannot be used (for `projectId`, when given), or null when it can. */
export function traceFileProblem(value: unknown, projectId?: string): string | null {
  if (!value || typeof value !== 'object') return i18n.t('traceability.errors.notATrace');
  const trace = value as Partial<TraceFile>;
  if (trace.schemaVersion !== TRACE_SCHEMA_VERSION) {
    return i18n.t('traceability.errors.schemaVersion', { found: String(trace.schemaVersion), expected: TRACE_SCHEMA_VERSION });
  }
  const lists = ['actors', 'tools', 'artifacts', 'operations', 'traceLinks'] as const;
  if (!lists.every((key) => Array.isArray(trace[key]))) return i18n.t('traceability.errors.notATrace');
  if (projectId !== undefined && trace.projectId !== projectId) return i18n.t('traceability.errors.otherProject');
  return null;
}

/** The stored trace, or one moved over from `localStorage`, checked; a new one when there is none. */
async function readStored(projectId: string): Promise<TraceFile> {
  let stored: unknown;
  try {
    stored = await storage.read(projectId);
  } catch (error) {
    console.warn(`The trace of project ${projectId} could not be read; starting a new one for this session.`, error);
    toast.warn(i18n.t('traceability.toasts.storageUnavailable'));
    return emptyTraceFile(projectId);
  }
  // A trace kept in `localStorage` before IndexedDB is moved over.
  const legacy = stored === undefined ? readLegacyTrace(projectId) : null;
  if (stored === undefined && legacy === null) return emptyTraceFile(projectId);
  try {
    const parsed = migrateTraceFile(legacy !== null ? JSON.parse(legacy) : stored);
    const problem = traceFileProblem(parsed, projectId);
    if (!problem) {
      if (legacy !== null) {
        await storage.write(projectId, parsed as TraceFile);
        removeLegacyTrace(projectId);
      }
      return parsed as TraceFile;
    }
    console.warn(`Stored trace of project ${projectId} is unusable (${problem}); starting a new one.`);
  } catch (error) {
    console.warn(`Stored trace of project ${projectId} could not be read; starting a new one.`, error);
  }
  toast.warn(i18n.t('traceability.toasts.storedTraceUnusable'));
  return emptyTraceFile(projectId);
}

/** Load a project's trace (once per session) and return it. */
export function loadProjectTrace(projectId: string): Promise<TraceFile> {
  const cached = cache.get(projectId);
  if (cached) return Promise.resolve(cached);
  let pending = loading.get(projectId);
  if (!pending) {
    const from = storage;
    pending = readStored(projectId).then((trace) => {
      if (from === storage && !cache.has(projectId)) cache.set(projectId, trace);
      loading.delete(projectId);
      notify();
      return cache.get(projectId) ?? trace;
    });
    loading.set(projectId, pending);
  }
  return pending;
}

/** The project's trace when it has been loaded (see {@link loadProjectTrace}), else undefined. */
export function getProjectTrace(projectId: string): TraceFile | undefined {
  return cache.get(projectId);
}

async function save(projectId: string): Promise<void> {
  unsaved.delete(projectId);
  const trace = cache.get(projectId);
  if (!trace) return;
  try {
    await storage.write(projectId, trace);
  } catch (error) {
    // Storage full: keep only the newest file content per path and try again.
    const dropped = pruneStoredContents(trace, 1);
    try {
      await storage.write(projectId, trace);
      if (dropped > 0) {
        console.warn(`Trace storage was full; dropped the stored content of ${dropped} older generated files.`, error);
        toast.warn(i18n.t('traceability.toasts.storagePruned', { count: dropped }));
      }
    } catch (retryError) {
      console.warn('Trace storage is full; the latest changes were not saved.', retryError);
      reportError(i18n.t('traceability.toasts.storageFull'), { error: retryError });
    }
  }
}

function scheduleSave(projectId: string): void {
  clearTimeout(unsaved.get(projectId));
  unsaved.set(projectId, setTimeout(() => void save(projectId), SAVE_DELAY_MS));
}

/** Save every trace with updates not yet saved; resolves when they are written. */
export function flushTraceSaves(): Promise<void> {
  const pending = [...unsaved.entries()];
  pending.forEach(([, timer]) => clearTimeout(timer));
  return Promise.all(pending.map(([projectId]) => save(projectId))).then(() => undefined);
}

if (typeof window !== 'undefined') {
  // Write what is pending before the tab goes away (closed, reloaded, sent to the background).
  window.addEventListener('pagehide', () => void flushTraceSaves());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushTraceSaves();
  });
}

/**
 * Apply `update` to the project trace (in place), save it and notify subscribers. It runs at once
 * when the trace is loaded, else as soon as it is, in the order updates were made. An update that
 * returns `false` changed nothing: nothing is saved.
 */
export function updateProjectTrace(projectId: string, update: (trace: TraceFile) => void | false): Promise<void> {
  const apply = (trace: TraceFile) => {
    if (update(trace) === false) return;
    // A new reference, so subscribers re-render.
    cache.set(projectId, { ...trace });
    scheduleSave(projectId);
    notify();
  };
  const cached = cache.get(projectId);
  if (cached) {
    apply(cached);
    return Promise.resolve();
  }
  return loadProjectTrace(projectId).then(() => apply(cache.get(projectId)!));
}

export function replaceProjectTrace(projectId: string, trace: TraceFile): Promise<void> {
  return updateProjectTrace(projectId, (current) => {
    Object.assign(current, trace);
  });
}

/**
 * Store the trace a project file brought along (a project export with its trace) as the trace of
 * the project it was imported as. An imported project gets a new id, so the trace is re-keyed.
 * An unusable trace is left out, with a warning: the project itself still imports.
 */
export function importProjectTrace(projectId: string, imported: unknown): boolean {
  const value = migrateTraceFile(imported);
  const problem = traceFileProblem(value);
  if (problem) {
    console.warn(`The imported project's trace is unusable (${problem}); importing the project without it.`);
    toast.warn(i18n.t('traceability.toasts.importedTraceUnusable', { problem }));
    return false;
  }
  void replaceProjectTrace(projectId, { ...(value as TraceFile), projectId });
  return true;
}

export function deleteProjectTrace(projectId: string): void {
  clearTimeout(unsaved.get(projectId));
  unsaved.delete(projectId);
  cache.delete(projectId);
  removeLegacyTrace(projectId);
  storage.remove(projectId).catch((error) => console.warn(`The trace of project ${projectId} could not be deleted.`, error));
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The project trace, re-rendering when it changes; null while it loads. */
export function useProjectTrace(projectId: string | undefined): TraceFile | null {
  const trace = useSyncExternalStore(subscribe, () => (projectId ? cache.get(projectId) ?? null : null));
  useEffect(() => {
    if (projectId) void loadProjectTrace(projectId);
  }, [projectId]);
  return trace;
}

/** Record the edits between two versions of a class diagram, when the project records traces. */
export function recordClassDiagramUpdate(
  project: BesserProject,
  diagram: ProjectDiagram,
  previousModel: unknown,
  nextModel: unknown,
  source: ModelingSource,
): void {
  if (!isTraceabilityEnabled(project)) return;
  const changes = diffClassModel(previousModel as ClassModelLike, nextModel as ClassModelLike);
  if (changes.length === 0) return;
  const now = new Date().toISOString(); // when the edit happened, not when the trace finished loading
  void updateProjectTrace(project.id, (trace) => {
    // Read when the update applies, after the request it answers has been recorded.
    const pending = source === 'assistant' && pendingRequest?.projectId === project.id ? pendingRequest : undefined;
    const requirements = pending?.requirements;
    if (pending && requirements) {
      pending.requirements = undefined; // recorded with the first edits that answer the request
      // Every edit of the turn was built from the request stating them, the later ones too.
      pending.requirementsRequest = requestStating(requirements, recentRequestsOf(project.id));
    }
    recordElementChanges(trace, changes, {
      diagramId: diagram.id,
      diagramTitle: diagram.title,
      actorName: traceActorName(project),
      source,
      now,
      request: pending?.request,
      requirements,
      requirementsRequest: pending?.requirementsRequest,
      model: nextModel as ClassModelLike,
    });
  });
}

/** The last request to the assistant: the edits it leads to are linked from it, and from the
 *  requirements the assistant extracted from it. One at a time, as the assistant answers one request
 *  at a time. */
let pendingRequest: {
  projectId: string;
  request: AssistantRequest;
  requirements?: AssistantRequirements;
  /** The request stating the turn's requirements, once they are recorded. */
  requirementsRequest?: AssistantRequest;
} | null = null;

/** Requests to the assistant kept to find the one a reply's requirements were extracted from: on a confirmed
 *  replace or an "Update model + generate", the assistant rebuilds the model from the application request of
 *  an earlier turn. */
const KEPT_RECENT_REQUESTS = 20;
let recentRequests: Array<{ projectId: string; request: AssistantRequest }> = [];

/** The project's recent requests, newest (the one under way) first. */
const recentRequestsOf = (projectId: string): AssistantRequest[] =>
  recentRequests.filter((r) => r.projectId === projectId).map((r) => r.request).reverse();

/**
 * Keep the requirements an assistant reply carries (`requirements`, `realizations` of an
 * `inject_complete_system`) for the request it answers: they are recorded with the edits the reply
 * makes. Call it before applying the reply.
 */
export function expectAssistantRequirements(
  project: BesserProject | null | undefined,
  reply: { requirements?: unknown; realizations?: unknown },
): void {
  if (!project || !isTraceabilityEnabled(project)) return;
  const requirements = readAssistantRequirements(reply);
  if (!requirements) return;
  // Queued like every update, so it applies after the request it answers has been recorded.
  void updateProjectTrace(project.id, () => {
    if (pendingRequest?.projectId === project.id) pendingRequest.requirements = requirements;
    return false;
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Record a request sent to the modeling assistant, when the project records traces: a new turn of the
 * conversation under way. Returns when it is recorded (it waits for the request's hash).
 */
export async function recordAssistantRequest(project: BesserProject | null | undefined, text: string): Promise<void> {
  if (!project || !isTraceabilityEnabled(project)) return;
  const now = new Date().toISOString();
  const contentHash = await sha256Hex(text);
  await updateProjectTrace(project.id, (trace) => {
    const { callId, logId } = recordConversationRequest(trace, text, { actorName: traceActorName(project), now });
    pendingRequest = { projectId: project.id, request: { callId, logId, text, contentHash } };
    recentRequests = [...recentRequests.slice(1 - KEPT_RECENT_REQUESTS), pendingRequest];
  });
}

/** The requirements the assistant extracted from the project's latest application request; none when
 *  the project does not record traces. */
export async function projectRequirements(project: BesserProject): Promise<RequirementArtifact[]> {
  if (!isTraceabilityEnabled(project)) return [];
  return latestRequirements(await loadProjectTrace(project.id));
}

/** Record what the assistant sent back: progress, its answer, or an error. */
export function recordAssistantReply(project: BesserProject | null | undefined, kind: AssistantReplyKind, text: string): void {
  if (!project || !isTraceabilityEnabled(project) || !text.trim()) return;
  const now = new Date().toISOString();
  void updateProjectTrace(project.id, (trace) => (recordConversationReply(trace, kind, text, now) ? undefined : false));
}

/** End the conversation under way: the user starts a new chat. */
export function endAssistantConversation(project: BesserProject | null | undefined): void {
  pendingRequest = null;
  if (!project || !isTraceabilityEnabled(project)) return;
  void updateProjectTrace(project.id, (trace) => (endConversation(trace) ? undefined : false));
}

/**
 * Record a change of a diagram itself (renamed, deleted), whatever its type. Only a diagram the
 * trace already knows is recorded: one that was never edited while recording enters the trace
 * with its current title on its first recorded edit.
 */
function recordDiagramChange(
  project: BesserProject,
  diagramId: string,
  title: string,
  change: Pick<ElementChange, 'kind' | 'feature' | 'oldValue' | 'newValue'>,
): void {
  if (!isTraceabilityEnabled(project)) return;
  const now = new Date().toISOString();
  void updateProjectTrace(project.id, (trace) => {
    const diagram = findModelArtifact(trace, diagramId);
    if (!diagram || diagram.parentId) return false;
    recordElementChanges(
      trace,
      [{ ...change, elementId: diagramId, elementType: diagram.elementType, name: title, parentElementId: null }],
      { diagramId, diagramTitle: title, actorName: traceActorName(project), source: 'user', now },
    );
  });
}

export function recordDiagramRenamed(project: BesserProject, diagramId: string, oldTitle: string, newTitle: string): void {
  if (oldTitle.trim() === newTitle.trim()) return;
  recordDiagramChange(project, diagramId, newTitle, { kind: 'UPDATED', feature: 'name', oldValue: oldTitle, newValue: newTitle });
}

export function recordDiagramDeleted(project: BesserProject, diagramId: string, title: string): void {
  recordDiagramChange(project, diagramId, title, { kind: 'DELETED', oldValue: title });
}

/** Merge the trace fragment of a generation run into the project trace; false when it was left out. */
export function recordGenerationTrace(projectId: string, received: unknown): boolean {
  // The backend may run an older version than the editor: its fragment is migrated like a stored trace,
  // and one that still cannot be used is left out rather than merged in a shape the views cannot read.
  const fragment = migrateTraceFile(received);
  const problem = traceFileProblem(fragment);
  if (problem) {
    console.warn(`The trace of this generation is unusable (${problem}); it was not recorded.`);
    toast.warn(i18n.t('traceability.toasts.generationTraceUnusable', { problem }));
    return false;
  }
  void updateProjectTrace(projectId, (trace) => mergeTraceFragment(trace, fragment as TraceFile));
  return true;
}
