import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import i18n from '../i18n';
import { reportError } from '../services/errors/reportError';
import { readLegacyTrace, removeLegacyTrace } from '../services/storage/legacyTraceStorage';
import { ALL_DIAGRAM_TYPES, getReferencedDiagram } from '../types/project';
import type { BesserProject, ElementLineageMap, ProjectDiagram, SupportedDiagramType } from '../types/project';
import { emptyTraceFile, TRACE_SCHEMA_VERSION } from '../types/traceability';
import type { RequirementArtifact, TraceFile } from '../types/traceability';
import type { ClassModelLike } from './classModelDiff';
import { alignDiagramArtifacts, DIAGRAM_MODEL_TYPES, snapshotDiagramModel } from './diagramModelDiff';
import { diffSnapshots } from './modelDiff';
import { diffGuiModel, guiBindings, pageSources } from './guiModelDiff';
import type { GuiModelLike } from './guiModelDiff';
import type { ElementChange } from './modelDiff';
import { indexedDbTraceStorage, memoryTraceStorage, isRevisionConflict, storedRevisionOf, withoutStoreRevision } from './traceDatabase';
import type { TraceStorage } from './traceDatabase';
import {
  endConversation,
  findModelArtifact,
  linkDerivedElements,
  mergeTraceFragment,
  pruneStoredContents,
  recordConversationReply,
  recordConversationRequest,
  recordElementChanges,
  recordSpecDrivenRun,
  GUI_GENERATOR_NAME,
} from './traceRecorder';
import type { DerivedElement, LlmUsage, RecordContext, SpecDrivenRunSummary } from './traceRecorder';
import { migrateTraceFile } from './traceMigration';
import { sanitizeTraceFile } from './traceSanitize';
import type { SanitizeOptions } from './traceSanitize';
import { reportTraceLoadProblem } from './traceLoadStatus';
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
 * Recording is per project (`settings.traceabilityEnabled`) and opt-in: off for a new project and when unset.
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

/** An update of a project trace (see {@link updateProjectTrace}). */
type TraceUpdate = (trace: TraceFile) => void | false;

/** The stored revision each loaded trace was read at or last saved as: a save names it, and is refused when another
 *  tab saved since (see `traceDatabase.ts`). */
const revisions = new Map<string, number>();
/** The updates applied to each loaded trace since it was last saved: on a refused save they are applied again on top
 *  of the trace the other tab stored, so neither tab's records are lost. */
const pendingUpdates = new Map<string, TraceUpdate[]>();
/** Saves and reloads of a project trace run one after the other. */
const busy = new Map<string, Promise<void>>();
/** Projects whose stored trace this editor cannot read (a newer schema after a rollback, over `TRACE_LIMITS`,
 *  damaged): the stored record is left as it is and nothing is recorded for them this session, until it is cleared. */
const unreadable = new Set<string>();

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
  revisions.clear();
  pendingUpdates.clear();
  busy.clear();
  unreadable.clear();
  guiBaselines.clear();
}

const notify = () => listeners.forEach((listener) => listener());

const pendingOf = (projectId: string): TraceUpdate[] => {
  let pending = pendingUpdates.get(projectId);
  if (!pending) pendingUpdates.set(projectId, (pending = []));
  return pending;
};

/** Run `task` after the save or reload of the project trace under way, if any. */
function serial(projectId: string, task: () => Promise<void>): Promise<void> {
  const previous = busy.get(projectId) ?? Promise.resolve();
  const next = previous.then(task, task);
  busy.set(projectId, next);
  void next.finally(() => {
    if (busy.get(projectId) === next) busy.delete(projectId);
  });
  return next;
}

/**
 * Other tabs with a project open are told when one of them saved its trace, so they read it again (with their own
 * updates not yet saved applied on top) and their views show the other tab's records.
 */
const CHANNEL_NAME = 'besser_traces';
interface TraceSavedMessage {
  projectId: string;
  /** The revision just stored; absent when the trace was deleted. */
  revision?: number;
}
const channel: BroadcastChannel | null = (() => {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    const opened = new BroadcastChannel(CHANNEL_NAME);
    (opened as unknown as { unref?: () => void }).unref?.(); // Node (tests): do not keep the process alive
    opened.onmessage = (event: MessageEvent) => onTraceSavedElsewhere(event.data);
    return opened;
  } catch {
    return null;
  }
})();

function announce(message: TraceSavedMessage): void {
  try {
    channel?.postMessage(message);
  } catch (error) {
    console.warn('Other tabs could not be told about a saved trace.', error);
  }
}

function onTraceSavedElsewhere(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const { projectId, revision } = data as Partial<TraceSavedMessage>;
  if (typeof projectId !== 'string' || !cache.has(projectId)) return;
  if (revision === undefined) {
    // Deleted in another tab, with its project.
    clearTimeout(unsaved.get(projectId));
    unsaved.delete(projectId);
    cache.delete(projectId);
    revisions.delete(projectId);
    pendingUpdates.delete(projectId);
    unreadable.delete(projectId);
    notify();
    return;
  }
  if (typeof revision !== 'number' || revisions.get(projectId) === revision) return;
  void serial(projectId, () => reloadTrace(projectId));
}

/**
 * Read the project trace again from storage and apply this tab's updates not yet saved on top of it: another tab
 * saved the trace in between, or an update failed halfway. A trace that cannot be read leaves the one in memory
 * as it is.
 */
async function reloadTrace(projectId: string): Promise<void> {
  const from = storage;
  let stored: unknown;
  try {
    stored = await storage.read(projectId);
  } catch (error) {
    console.warn(`The trace of project ${projectId} could not be read again.`, error);
    return;
  }
  if (from !== storage || !cache.has(projectId)) return;
  const revision = storedRevisionOf(stored);
  const parsed = stored === undefined ? emptyTraceFile(projectId) : usableStoredTrace(projectId, stored);
  if (!parsed) {
    // Unusable (written by a newer editor, damaged): kept as stored, and this tab stops recording.
    stopRecording(projectId);
    return;
  }
  const pending = pendingOf(projectId);
  pendingUpdates.set(projectId, pending.filter((update) => applySafely(parsed, update) !== false));
  cache.set(projectId, parsed);
  revisions.set(projectId, revision);
  if (pendingUpdates.get(projectId)!.length > 0 && !unsaved.has(projectId)) scheduleSave(projectId);
  notify();
}

/** Stop recording a project whose stored trace cannot be read, so it is never overwritten; the user is warned. */
function stopRecording(projectId: string): void {
  if (unreadable.has(projectId)) return;
  unreadable.add(projectId);
  clearTimeout(unsaved.get(projectId));
  unsaved.delete(projectId);
  pendingUpdates.delete(projectId);
  console.warn(`Stored trace of project ${projectId} is unusable; it is kept as it is and nothing is recorded this session.`);
  toast.warn(i18n.t('traceability.toasts.storedTraceUnusable'));
  reportTraceLoadProblem(projectId, 'unusable');
}

/** Apply `update`, returning `false` when it changed nothing or failed (logged). */
function applySafely(trace: TraceFile, update: TraceUpdate): void | false {
  try {
    return update(trace);
  } catch (error) {
    console.error('A change could not be recorded in the project trace.', error);
    return false;
  }
}

export const isTraceabilityEnabled = (project: BesserProject | null | undefined): boolean =>
  project?.settings?.traceabilityEnabled === true;

/** The longest actor name a traced generation accepts (`TRACE_MAX_ACTOR_NAME_LENGTH` in the backend's constants):
 *  the owner's name is cut to it, so the editor and the backend record the same actor. */
export const MAX_ACTOR_NAME_LENGTH = 200;

export const traceActorName = (project: BesserProject): string =>
  project.owner?.trim().slice(0, MAX_ACTOR_NAME_LENGTH).trim() || ANONYMOUS_ACTOR;

/** Why a trace file cannot be used (for `projectId`, when given), or null when it can. */
export function traceFileProblem(value: unknown, projectId?: string): string | null {
  if (!value || typeof value !== 'object') return i18n.t('traceability.errors.notATrace');
  const trace = value as Partial<TraceFile>;
  if (typeof trace.schemaVersion === 'number' && trace.schemaVersion > TRACE_SCHEMA_VERSION) {
    // Written by a newer backend or editor: this editor cannot know what its new fields mean.
    return i18n.t('traceability.errors.newerSchemaVersion', { found: String(trace.schemaVersion), expected: TRACE_SCHEMA_VERSION });
  }
  if (trace.schemaVersion !== TRACE_SCHEMA_VERSION) {
    return i18n.t('traceability.errors.schemaVersion', { found: String(trace.schemaVersion), expected: TRACE_SCHEMA_VERSION });
  }
  const lists = ['actors', 'tools', 'artifacts', 'operations', 'traceLinks'] as const;
  if (!lists.every((key) => Array.isArray(trace[key]))) return i18n.t('traceability.errors.notATrace');
  if (projectId !== undefined && trace.projectId !== projectId) return i18n.t('traceability.errors.otherProject');
  return null;
}

/**
 * A trace from outside this tab's recording (stored, imported, a backend fragment) as a usable trace file: migrated,
 * checked at the top level ({@link traceFileProblem}) and item by item (`sanitizeTraceFile`: malformed items,
 * dangling references and parent cycles dropped, a too large trace refused). Never throws.
 */
export function readTraceFile(
  value: unknown, options: { projectId?: string } & SanitizeOptions = {},
): { trace: TraceFile; problem?: undefined } | { problem: string } {
  let migrated: unknown;
  try {
    migrated = migrateTraceFile(value);
  } catch (error) {
    console.warn('A trace could not be migrated.', error);
    return { problem: i18n.t('traceability.errors.notATrace') };
  }
  const problem = traceFileProblem(migrated, options.projectId);
  if (problem) return { problem };
  const result = sanitizeTraceFile(migrated as TraceFile, options);
  if ('tooLarge' in result) {
    const { list, count, max } = result.tooLarge;
    return { problem: i18n.t('traceability.errors.tooLarge', { list, count, max }) };
  }
  if (result.dropped > 0) console.warn(`Left out ${result.dropped} malformed or dangling item(s) of a trace.`);
  return { trace: result.trace };
}

/** A stored trace as a usable trace file (migrated, checked), or undefined (logged) when it cannot be used. */
function usableStoredTrace(projectId: string, stored: unknown): TraceFile | undefined {
  const read = readTraceFile(withoutStoreRevision(stored), { projectId });
  if (read.problem === undefined) return read.trace;
  console.warn(`Stored trace of project ${projectId} is unusable (${read.problem}).`);
  return undefined;
}

/** The stored trace and its revision, or one moved over from `localStorage`, checked; a new one when there is none. */
async function readStored(projectId: string): Promise<{ trace: TraceFile; revision: number; unusable?: boolean }> {
  let stored: unknown;
  try {
    stored = await storage.read(projectId);
  } catch (error) {
    console.warn(`The trace of project ${projectId} could not be read; starting a new one for this session.`, error);
    toast.warn(i18n.t('traceability.toasts.storageUnavailable'));
    reportTraceLoadProblem(projectId, 'storageUnavailable');
    return { trace: emptyTraceFile(projectId), revision: 0 };
  }
  const revision = storedRevisionOf(stored);
  // A trace kept in `localStorage` before IndexedDB is moved over.
  const legacy = stored === undefined ? readLegacyTrace(projectId) : null;
  if (stored === undefined && legacy === null) return { trace: emptyTraceFile(projectId), revision };
  let parsedLegacy: unknown = undefined;
  if (legacy !== null) {
    try {
      parsedLegacy = JSON.parse(legacy);
    } catch (error) {
      console.warn(`The trace of project ${projectId} kept in localStorage could not be read.`, error);
    }
  }
  const trace = usableStoredTrace(projectId, legacy !== null ? parsedLegacy : stored);
  if (trace) {
    if (legacy === null) return { trace, revision };
    try {
      const moved = await storage.write(projectId, trace, revision);
      removeLegacyTrace(projectId);
      return { trace, revision: moved };
    } catch (error) {
      console.warn(`The trace of project ${projectId} could not be moved from localStorage; it is kept there.`, error);
      return { trace, revision };
    }
  }
  return { trace: emptyTraceFile(projectId), revision, unusable: true };
}

/** Load a project's trace (once per session) and return it. */
export function loadProjectTrace(projectId: string): Promise<TraceFile> {
  const cached = cache.get(projectId);
  if (cached) return Promise.resolve(cached);
  let pending = loading.get(projectId);
  if (!pending) {
    const from = storage;
    // Read after the save or delete of the trace under way: a load right after "Clear trace" must not read the
    // trace being deleted.
    const settled = (busy.get(projectId) ?? Promise.resolve()).catch(() => undefined);
    const load: Promise<TraceFile> = settled.then(() => readStored(projectId)).then(({ trace, revision, unusable }) => {
      // A delete while it loaded makes this load stale (`loading` forgotten): it must not bring the trace back.
      const current = loading.get(projectId) === load;
      if (current) loading.delete(projectId);
      if (current && from === storage && !cache.has(projectId)) {
        cache.set(projectId, trace);
        revisions.set(projectId, revision);
        if (unusable) stopRecording(projectId);
      }
      notify();
      return cache.get(projectId) ?? trace;
    });
    pending = load;
    loading.set(projectId, pending);
  }
  return pending;
}

/** The project's trace when it has been loaded (see {@link loadProjectTrace}), else undefined. */
export function getProjectTrace(projectId: string): TraceFile | undefined {
  return cache.get(projectId);
}

/** Whether a failed write failed because the storage is full (IndexedDB's quota). */
const isQuotaError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'QuotaExceededError';

/** Keep only the newest stored content per generated file path (the trace no longer fits in the storage). */
const pruneContents: TraceUpdate = (trace) => (pruneStoredContents(trace, 1) > 0 ? undefined : false);

/** Save the project trace, unless another save or reload of it is under way (it then saves after it). */
function save(projectId: string): Promise<void> {
  clearTimeout(unsaved.get(projectId));
  unsaved.delete(projectId);
  return serial(projectId, () => saveNow(projectId));
}

const MAX_SAVE_ATTEMPTS = 5;

async function saveNow(projectId: string): Promise<void> {
  let pruned = 0;
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
    if (!cache.has(projectId) || unreadable.has(projectId)) return; // deleted meanwhile, or not ours to overwrite
    const from = storage;
    let sent = 0;
    try {
      const revision = await storage.write(
        projectId,
        // Taken when the write happens: the updates made until then are in it.
        () => {
          sent = pendingOf(projectId).length;
          return cache.get(projectId) ?? emptyTraceFile(projectId);
        },
        revisions.get(projectId) ?? 0,
      );
      if (from !== storage) return;
      revisions.set(projectId, revision);
      pendingOf(projectId).splice(0, sent);
      announce({ projectId, revision });
      if (pruned > 0) toast.warn(i18n.t('traceability.toasts.storagePruned', { count: pruned }));
      return;
    } catch (error) {
      if (from !== storage) return;
      if (isRevisionConflict(error)) {
        // Another tab saved in between: take its trace, with this tab's updates on top, and save that.
        await reloadTrace(projectId);
        continue;
      }
      const trace = cache.get(projectId);
      if (isQuotaError(error) && pruned === 0 && trace) {
        // Storage full: keep only the newest file content per path and try again.
        pruned = pruneStoredContents(trace, 1);
        if (pruned > 0) {
          pendingOf(projectId).push(pruneContents);
          cache.set(projectId, { ...trace }); // a new reference, so views show the dropped contents
          notify();
          console.warn(`Trace storage was full; dropping the stored content of ${pruned} older generated files.`, error);
          continue;
        }
      }
      if (isQuotaError(error)) {
        console.warn('Trace storage is full; the latest changes were not saved.', error);
        reportError(i18n.t('traceability.toasts.storageFull'), { error });
      } else {
        console.warn('The project trace could not be saved; the latest changes are kept in this tab.', error);
        reportError(i18n.t('traceability.toasts.saveFailed'), { error });
      }
      return;
    }
  }
  console.warn(`The trace of project ${projectId} kept being saved by another tab; it is saved again with the next change.`);
}

function scheduleSave(projectId: string): void {
  clearTimeout(unsaved.get(projectId));
  unsaved.set(projectId, setTimeout(() => void save(projectId), SAVE_DELAY_MS));
}

/** Save every trace with updates not yet saved; resolves when they are written. */
export function flushTraceSaves(): Promise<void> {
  const pending = [...unsaved.keys()];
  return Promise.all([...pending.map((projectId) => save(projectId)), ...busy.values()]).then(() => undefined);
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
 * returns `false` changed nothing: nothing is saved. An update that throws is not recorded (the user is
 * warned) and never rejects: recording a trace must not break what it records.
 *
 * Updates are kept until saved: when another tab saved the trace meanwhile, they are applied again on top
 * of its trace, so an update must only depend on the trace it is given and on what it captured.
 */
export function updateProjectTrace(projectId: string, update: TraceUpdate): Promise<void> {
  const apply = (trace: TraceFile) => {
    if (unreadable.has(projectId)) return; // its stored trace cannot be read: nothing is recorded
    let result: void | false;
    try {
      result = update(trace);
    } catch (error) {
      console.error('A change could not be recorded in the project trace.', error);
      toast.warn(i18n.t('traceability.toasts.recordFailed'));
      // It may have changed part of the trace: rebuild it from what is stored and the updates not yet saved.
      void serial(projectId, () => reloadTrace(projectId));
      return;
    }
    if (result === false) return;
    pendingOf(projectId).push(update);
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
  return loadProjectTrace(projectId).then(() => {
    const loaded = cache.get(projectId);
    if (loaded) apply(loaded);
  });
}

export function replaceProjectTrace(projectId: string, trace: TraceFile): Promise<void> {
  return updateProjectTrace(projectId, (current) => {
    // Field by field, not Object.assign: an own `__proto__` key of `trace` would replace `current`'s prototype.
    const { schemaVersion, projectId: id, actors, tools, artifacts, operations, traceLinks } = trace;
    Object.assign(current, { schemaVersion, projectId: id, actors, tools, artifacts, operations, traceLinks });
  });
}

/**
 * Store the trace a project file brought along (a project export with its trace) as the trace of
 * the project it was imported as. An imported project gets a new id, so the trace is re-keyed.
 * An unusable trace is left out, with a warning: the project itself still imports.
 */
export function importProjectTrace(projectId: string, imported: unknown): boolean {
  const trace = readImportedTrace(imported);
  if (!trace) return false;
  void replaceProjectTrace(projectId, { ...trace, projectId });
  return true;
}

/**
 * The trace a project file brought along, migrated and checked, without storing it: an import checks the trace
 * with the project and stores it ({@link importProjectTrace}) only once the project itself is saved, so a project
 * that fails to import leaves no trace behind. Undefined (with a warning) when it cannot be used.
 */
export function readImportedTrace(imported: unknown): TraceFile | undefined {
  const read = readTraceFile(imported);
  if (read.problem !== undefined) {
    console.warn(`The imported project's trace is unusable (${read.problem}); importing the project without it.`);
    toast.warn(i18n.t('traceability.toasts.importedTraceUnusable', { problem: read.problem }));
    return undefined;
  }
  return read.trace;
}

export function deleteProjectTrace(projectId: string): void {
  clearTimeout(unsaved.get(projectId));
  unsaved.delete(projectId);
  cache.delete(projectId);
  loading.delete(projectId);
  revisions.delete(projectId);
  pendingUpdates.delete(projectId);
  unreadable.delete(projectId);
  removeLegacyTrace(projectId);
  void serial(projectId, () =>
    storage.remove(projectId).then(
      () => announce({ projectId }),
      (error) => console.warn(`The trace of project ${projectId} could not be deleted.`, error),
    ),
  );
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

/** A model generator that wrote a diagram, rather than the user in the editor or the assistant: a template
 *  loaded, a file or a picture imported, a model derived from another one. Its changes are one session of the
 *  generator (a `ModelGenerator` tool), performed for the user; `source` names the model it was derived from,
 *  with each derived element's source element (`elements`: derived element id -> source element id). */
export interface ModelGeneratorSource {
  generator: string;
  source?: { diagramId: string; elements?: ElementLineageMap };
  /** Why a derived element's link holds; {@link DERIVATION_RULE} when unset. */
  rule?: string;
}

/** Who made a diagram's changes: the user, the assistant, or a model generator. */
export type DiagramChangeSource = ModelingSource | ModelGeneratorSource;

/** The model generators of the editor itself, by what they do (the names the trace records). */
export const MODEL_GENERATORS = {
  template: 'BESSER template library',
  fileImport: 'BESSER diagram import',
  pictureImport: 'BESSER image-to-model import',
  agentVariant: 'BESSER agent personalization',
  kgToClass: 'BESSER knowledge graph to class diagram converter',
  bpmnToComponent: 'BESSER BPMN to component diagram derivation',
  componentToDeployment: 'BESSER component to deployment diagram derivation',
  laneToAgent: 'BESSER BPMN lane to agent derivation',
} as const;

/** Why a derived element is linked from the element it was derived from. */
export const DERIVATION_RULE = 'element derived from the source element by the model generator';

const isGeneratorSource = (source: DiagramChangeSource | 'derivation'): source is ModelGeneratorSource =>
  typeof source === 'object' && source !== null;

/** The diagram type `diagram` belongs to in `project`, or undefined when the project does not hold it. */
export function diagramTypeOf(project: BesserProject, diagramId: string): SupportedDiagramType | undefined {
  return ALL_DIAGRAM_TYPES.find((type) => (project.diagrams[type] ?? []).some((d) => d.id === diagramId));
}

function findDiagram(project: BesserProject, diagramId: string): ProjectDiagram | undefined {
  for (const type of ALL_DIAGRAM_TYPES) {
    const found = (project.diagrams[type] ?? []).find((d) => d.id === diagramId);
    if (found) return found;
  }
  return undefined;
}

/** The pending assistant request an assistant's edit answers, or undefined (no turn under way, or it ended too long
 *  ago for this edit to be part of it). */
function requestAnswered(projectId: string, now: string): PendingRequest | undefined {
  if (pendingRequest?.projectId !== projectId) return undefined;
  if (pendingRequest.endedAt !== undefined && Date.parse(now) - Date.parse(pendingRequest.endedAt) > TURN_GRACE_MS) {
    pendingRequest = null; // the turn is over: a later edit is not its answer
    return undefined;
  }
  return pendingRequest;
}

/** The derived elements of `mapping` (derived element id -> source element id) that both models trace. */
function derivedElements(
  sourceType: SupportedDiagramType, source: ProjectDiagram, mapping: ElementLineageMap,
): DerivedElement[] {
  const snapshots = snapshotDiagramModel(sourceType, source.model, source.id);
  const result: DerivedElement[] = [];
  for (const [derivedId, sourceId] of Object.entries(mapping)) {
    const found = snapshots.get(sourceId);
    if (!found) continue;
    const owner = found.parentElementId ? snapshots.get(found.parentElementId) : undefined;
    result.push({
      elementId: derivedId,
      source: {
        elementId: sourceId, elementType: found.elementType, name: found.name,
        ...(owner && found.parentElementId ? { parent: { elementId: found.parentElementId, elementType: owner.elementType, name: owner.name } } : {}),
      },
    });
  }
  return result;
}

/**
 * Record the changes between two versions of a diagram of any type, when the project records traces: a modeling
 * session of the user or the assistant (an assistant's edits are linked from the request they answer, and a class
 * diagram's from the requirements it extracted), or one session of a model generator. A GUI goes through
 * {@link recordGuiDiagramUpdate}, with its bindings.
 */
export function recordDiagramUpdate(
  project: BesserProject,
  diagramType: SupportedDiagramType,
  diagram: ProjectDiagram,
  previousModel: unknown,
  nextModel: unknown,
  source: DiagramChangeSource,
): void {
  if (diagramType === 'GUINoCodeDiagram') {
    recordGuiDiagramUpdate(project, diagram, previousModel, nextModel, source);
    return;
  }
  if (!isTraceabilityEnabled(project)) return;
  const before = snapshotDiagramModel(diagramType, previousModel, diagram.id);
  const after = snapshotDiagramModel(diagramType, nextModel, diagram.id);
  const changes = diffSnapshots(before, after);
  if (changes.length === 0) return;
  const now = new Date().toISOString(); // when the edit happened, not when the trace finished loading
  const generator = isGeneratorSource(source) ? source : undefined;
  const derivedFrom = generator?.source ? findDiagram(project, generator.source.diagramId) : undefined;
  const derivedFromType = derivedFrom && diagramTypeOf(project, derivedFrom.id);
  void updateProjectTrace(project.id, (trace) => {
    // Read when the update applies, after the request it answers has been recorded.
    const pending = source === 'assistant' ? requestAnswered(project.id, now) : undefined;
    const requirements = diagramType === 'ClassDiagram' ? pending?.requirements : undefined;
    if (pending && requirements) {
      pending.requirements = undefined; // recorded with the first edits that answer the request
      // Every edit of the turn was built from the request stating them, the later ones too.
      pending.requirementsRequest = requestStating(requirements, recentRequestsOf(project.id));
    }
    const ctx: RecordContext = {
      diagramId: diagram.id,
      diagramTitle: diagram.title,
      modelType: DIAGRAM_MODEL_TYPES[diagramType],
      actorName: traceActorName(project),
      source: source === 'assistant' ? 'assistant' : 'user',
      now,
      request: pending?.request,
      requirements,
      requirementsRequest: pending?.requirementsRequest,
      ...(diagramType === 'ClassDiagram' ? { model: nextModel as ClassModelLike } : {}),
      ...(generator ? { generatorName: generator.generator } : {}),
    };
    if (derivedFrom && derivedFromType && generator?.source?.elements) {
      // Each derived element is linked from the element it was derived from, by the generator's session.
      ctx.bindings = new Map(derivedElements(derivedFromType, derivedFrom, generator.source.elements).map((d) => [d.elementId, [d.source]]));
      ctx.boundModel = { id: derivedFrom.id, title: derivedFrom.title, modelType: DIAGRAM_MODEL_TYPES[derivedFromType] };
      ctx.bindingRule = generator.rule ?? DERIVATION_RULE;
    }
    // What an earlier version recorded differently is brought in line with this edit (`alignDiagramArtifacts`).
    recordElementChanges(trace, [...changes, ...alignDiagramArtifacts(trace, diagram.id, after, before)], ctx);
  });
}

/** Record the edits between two versions of a class diagram, when the project records traces. */
export function recordClassDiagramUpdate(
  project: BesserProject,
  diagram: ProjectDiagram,
  previousModel: unknown,
  nextModel: unknown,
  source: DiagramChangeSource,
): void {
  recordDiagramUpdate(project, 'ClassDiagram', diagram, previousModel, nextModel, source);
}

/**
 * Record that a diagram was added to the project (empty, or with the model it was created with, which is then
 * recorded as its first changes, by `source`).
 */
export function recordDiagramCreated(
  project: BesserProject,
  diagramType: SupportedDiagramType,
  diagram: ProjectDiagram,
  source: DiagramChangeSource = 'user',
): void {
  if (!isTraceabilityEnabled(project)) return;
  const now = new Date().toISOString();
  const generator = isGeneratorSource(source) ? source : undefined;
  void updateProjectTrace(project.id, (trace) => {
    if (findModelArtifact(trace, diagram.id)) return false; // already known (a replayed creation)
    recordElementChanges(
      trace,
      [{ kind: 'CREATED', elementId: diagram.id, elementType: DIAGRAM_MODEL_TYPES[diagramType], name: diagram.title, parentElementId: null, newValue: diagram.title }],
      {
        diagramId: diagram.id, diagramTitle: diagram.title, modelType: DIAGRAM_MODEL_TYPES[diagramType],
        actorName: traceActorName(project), source: source === 'assistant' ? 'assistant' : 'user', now,
        ...(generator ? { generatorName: generator.generator } : {}),
      },
    );
  });
  if (diagram.model !== undefined) recordDiagramUpdate(project, diagramType, diagram, undefined, diagram.model, source);
}

/**
 * Feed a derived diagram's element lineage (`project.elementLineage[derivedDiagramId]`: derived element id ->
 * source element id, written by the inter-diagram derivations) into the trace: each derived element is linked from
 * its source element by the generator session that wrote the derived diagram (see `linkDerivedElements`).
 */
export function recordElementLineage(
  project: BesserProject,
  derivedDiagramId: string,
  mapping: ElementLineageMap,
  generator: string,
  sourceDiagramId?: string,
): void {
  if (!isTraceabilityEnabled(project)) return;
  const derived = findDiagram(project, derivedDiagramId);
  const derivedType = derived && diagramTypeOf(project, derived.id);
  const sourceId = sourceDiagramId ?? derived?.derivedFrom?.sourceDiagramId;
  const source = sourceId ? findDiagram(project, sourceId) : undefined;
  const sourceType = source && diagramTypeOf(project, source.id);
  if (!derived || !derivedType || !source || !sourceType) return;
  const elements = derivedElements(sourceType, source, mapping);
  if (elements.length === 0) return;
  const now = new Date().toISOString();
  void updateProjectTrace(project.id, (trace) =>
    linkDerivedElements(trace, elements, {
      diagramId: derived.id, diagramTitle: derived.title, modelType: DIAGRAM_MODEL_TYPES[derivedType],
      sourceModel: { id: source.id, title: source.title, modelType: DIAGRAM_MODEL_TYPES[sourceType] },
      generatorName: generator, rule: DERIVATION_RULE, actorName: traceActorName(project), now,
    }) ? undefined : false,
  );
}

/** Who made a GUI diagram's changes: the user, the assistant, the GUI generator deriving it from the class
 *  diagram (for the user), or another model generator. */
export type GuiChangeSource = DiagramChangeSource | 'derivation';

/**
 * The GUI each GUI diagram was last recorded at, by diagram id: what its next change is compared with. Kept here,
 * not in the GUI editor, so the editor's saves and the assistant's writes (through the store, possibly while the
 * editor is closed) are compared with one another: a GUI recorded by one is not recorded again by the other, and
 * the assistant's changes are never attributed to the user's next save.
 */
const guiBaselines = new Map<string, unknown>();

/** Whether a GUI diagram has a recorded baseline (see {@link setGuiBaseline}). */
export const hasGuiBaseline = (diagramId: string): boolean => guiBaselines.has(diagramId);

/** Take `model` as what a GUI diagram's next change is compared with (the GUI as the editor loaded it). */
export function setGuiBaseline(diagramId: string, model: unknown): void {
  guiBaselines.set(diagramId, model);
}

/**
 * Record the changes between two versions of a GUI diagram, when the project records traces: a modeling
 * session of the user or the assistant, or the one session of a GUI generator run. Each changed element is
 * linked to the class-diagram elements it is bound to (the diagram the GUI references); an assistant's edits are
 * linked from the request they answer, as for a class diagram. The changes are taken from the GUI last recorded
 * for this diagram ({@link setGuiBaseline}), else from `previousModel` (undefined: from nothing).
 */
export function recordGuiDiagramUpdate(
  project: BesserProject,
  diagram: ProjectDiagram,
  previousModel: unknown,
  nextModel: unknown,
  source: GuiChangeSource,
): void {
  if (!isTraceabilityEnabled(project)) {
    guiBaselines.delete(diagram.id); // edits made while off are not attributed to the next recorded one
    return;
  }
  const previous = guiBaselines.has(diagram.id) ? guiBaselines.get(diagram.id) : previousModel;
  guiBaselines.set(diagram.id, nextModel);
  const classDiagram = getReferencedDiagram(project, diagram, 'ClassDiagram');
  const classModel = classDiagram?.model as ClassModelLike | undefined;
  const changes = diffGuiModel(previous as GuiModelLike, nextModel as GuiModelLike, classModel);
  if (changes.length === 0) return;
  const now = new Date().toISOString(); // when the edit happened, not when the trace finished loading
  const derived = source === 'derivation';
  const generator = derived ? GUI_GENERATOR_NAME : isGeneratorSource(source) ? source.generator : undefined;
  // A generator run also derives each page from the classes it shows: the page is generated for them.
  const bindings = new Map([
    ...guiBindings(nextModel as GuiModelLike, classModel),
    ...(derived ? pageSources(nextModel as GuiModelLike, classModel) : []),
  ]);
  void updateProjectTrace(project.id, (trace) => {
    const pending = source === 'assistant' ? requestAnswered(project.id, now) : undefined;
    const ctx: RecordContext = {
      diagramId: diagram.id,
      diagramTitle: diagram.title,
      modelType: 'GUIModel',
      actorName: traceActorName(project),
      source: source === 'assistant' ? 'assistant' : 'user',
      now,
      request: pending?.request,
      bindings,
      ...(classDiagram ? { boundModel: { id: classDiagram.id, title: classDiagram.title, modelType: 'DomainModel' } } : {}),
      ...(generator ? { generatorName: generator } : {}),
    };
    recordElementChanges(trace, changes, ctx);
  });
}

/** An assistant edit this long after its turn's last terminal reply is not part of the turn any more. */
export const TURN_GRACE_MS = 30 * 1000;

interface PendingRequest {
  projectId: string;
  request: AssistantRequest;
  requirements?: AssistantRequirements;
  /** The request stating the turn's requirements, once they are recorded. */
  requirementsRequest?: AssistantRequest;
  /** When the turn's last answer or error came; edits come with it or right after it. */
  endedAt?: string;
}

/** The last request to the assistant: the edits it leads to are linked from it, and from the
 *  requirements the assistant extracted from it. One at a time, as the assistant answers one request
 *  at a time; it no longer answers once its turn has been over for {@link TURN_GRACE_MS}. */
let pendingRequest: PendingRequest | null = null;

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

/**
 * Record what the assistant sent back: progress, its answer, or an error. `usage` (`llmUsage` of a terminal
 * reply: the model and tokens of the turn) files the turn under the model that really ran.
 */
export function recordAssistantReply(
  project: BesserProject | null | undefined, kind: AssistantReplyKind, text: string, usage?: LlmUsage,
): void {
  if (!project || !isTraceabilityEnabled(project) || (!text.trim() && !usage)) return;
  const now = new Date().toISOString();
  if (kind !== 'progress' && pendingRequest?.projectId === project.id) pendingRequest.endedAt = now;
  void updateProjectTrace(project.id, (trace) => (recordConversationReply(trace, kind, text, now, usage) ? undefined : false));
}

/** The `llmUsage` a reply of the modeling agent carries, checked field by field (the reply is untrusted), or
 *  undefined when it carries none that can be used. */
export function readLlmUsage(raw: unknown): LlmUsage | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const usage = raw as Record<string, unknown>;
  const model = typeof usage.model === 'string' ? usage.model.trim().slice(0, 200) : '';
  if (!model) return undefined;
  const provider = typeof usage.provider === 'string' && usage.provider.trim() ? usage.provider.trim().slice(0, 100) : undefined;
  const tokens = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined);
  const [inputTokens, outputTokens] = [tokens(usage.inputTokens), tokens(usage.outputTokens)];
  return {
    model,
    ...(provider ? { provider } : {}),
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
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

/**
 * Record a Spec-Driven run: the trace fragment its `done` event carried, merged like a generation's; else, for a
 * backend that sends none, the operation the stream's own events describe (`recordSpecDrivenRun`), so a run is
 * never missing from the trace.
 */
export function recordSpecDrivenOutcome(
  project: BesserProject | null | undefined, fragment: unknown, summary: Omit<SpecDrivenRunSummary, 'actorName'>,
): void {
  if (!project || !isTraceabilityEnabled(project)) return;
  if (fragment !== undefined && fragment !== null && recordGenerationTrace(project.id, { ...(fragment as object), projectId: project.id })) return;
  void updateProjectTrace(project.id, (trace) =>
    recordSpecDrivenRun(trace, { ...summary, actorName: traceActorName(project) }) ? undefined : false,
  );
}

/**
 * The trace fragment of a generation run, migrated and checked, or undefined (the user is warned) when it cannot be
 * recorded. Never throws.
 */
export function readGenerationTrace(received: unknown): TraceFile | undefined {
  // The backend may run an older version than the editor: its fragment is migrated like a stored trace,
  // and one that still cannot be used is left out rather than merged in a shape the views cannot read.
  // Its references may name the project trace's own artifacts.
  const read = readTraceFile(received, { externalReferences: true });
  if (read.problem !== undefined) {
    console.warn(`The trace of this generation is unusable (${read.problem}); it was not recorded.`);
    toast.warn(i18n.t('traceability.toasts.generationTraceUnusable', { problem: read.problem }));
    return undefined;
  }
  return read.trace;
}

/**
 * Merge the trace fragment of a generation run into the project trace; false when it was left out. Never throws:
 * a fragment that fails to merge is left out with a warning ({@link updateProjectTrace}).
 */
export function recordGenerationTrace(projectId: string, received: unknown): boolean {
  const fragment = readGenerationTrace(received);
  if (!fragment) return false;
  void updateProjectTrace(projectId, (trace) => mergeTraceFragment(trace, fragment));
  return true;
}
