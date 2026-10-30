import { useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import i18n from '../i18n';
import type { BesserProject, ProjectDiagram } from '../types/project';
import { emptyTraceFile, TRACE_SCHEMA_VERSION } from '../types/traceability';
import type { TraceFile } from '../types/traceability';
import { diffClassModel } from './classModelDiff';
import type { ClassModelLike, ElementChange } from './classModelDiff';
import { findModelArtifact, mergeTraceFragment, pruneStoredContents, recordElementChanges } from './traceRecorder';
import type { ModellingSource } from './traceRecorder';

/**
 * The project trace, kept in `localStorage` under `besser_traces_<projectId>`,
 * apart from the project itself (`besser_project_<projectId>`), and exported
 * with the project when the user ticks it in the Export dialog (the `trace` of
 * the JSON envelope, the TRACEABILITY section of the B-UML file).
 *
 * Recording is opt-in per project (`settings.traceabilityEnabled`).
 */

export const TRACE_STORAGE_PREFIX = 'besser_traces_';
/** Recorded when the project has no owner. Mirrors `TRACE_ANONYMOUS_ACTOR` in the backend. */
export const ANONYMOUS_ACTOR = 'anonymous';

const traceKey = (projectId: string) => `${TRACE_STORAGE_PREFIX}${projectId}`;

const cache = new Map<string, TraceFile>();
const listeners = new Set<() => void>();

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

function load(projectId: string): TraceFile {
  const raw = localStorage.getItem(traceKey(projectId));
  if (!raw) return emptyTraceFile(projectId);
  try {
    const parsed = JSON.parse(raw);
    const problem = traceFileProblem(parsed, projectId);
    if (!problem) return parsed as TraceFile;
    console.warn(`Stored trace of project ${projectId} is unusable (${problem}); starting a new one.`);
  } catch (error) {
    console.warn(`Stored trace of project ${projectId} is not JSON; starting a new one.`, error);
  }
  toast.warn(i18n.t('traceability.toasts.storedTraceUnusable'));
  return emptyTraceFile(projectId);
}

function persist(projectId: string, trace: TraceFile): void {
  const write = () => localStorage.setItem(traceKey(projectId), JSON.stringify(trace));
  try {
    write();
  } catch {
    // Storage full: keep only the newest file content per path and try again.
    const dropped = pruneStoredContents(trace, 1);
    try {
      write();
      if (dropped > 0) {
        console.warn(`Trace storage was full; dropped the stored content of ${dropped} older generated files.`);
        toast.warn(i18n.t('traceability.toasts.storagePruned', { count: dropped }));
      }
    } catch (error) {
      console.warn('Trace storage is full; this change was not saved.', error);
      toast.error(i18n.t('traceability.toasts.storageFull'));
    }
  }
}

export function getProjectTrace(projectId: string): TraceFile {
  let trace = cache.get(projectId);
  if (!trace) {
    trace = load(projectId);
    cache.set(projectId, trace);
  }
  return trace;
}

/** Apply `update` to the project trace (in place), save it and notify subscribers. */
export function updateProjectTrace(projectId: string, update: (trace: TraceFile) => void): void {
  const trace = getProjectTrace(projectId);
  update(trace);
  // A new reference, so subscribers re-render.
  const published = { ...trace };
  cache.set(projectId, published);
  persist(projectId, published);
  listeners.forEach((listener) => listener());
}

export function replaceProjectTrace(projectId: string, trace: TraceFile): void {
  updateProjectTrace(projectId, (current) => Object.assign(current, trace));
}

/**
 * Store the trace a project file brought along (a project export with its trace) as the trace of
 * the project it was imported as. An imported project gets a new id, so the trace is re-keyed.
 * An unusable trace is left out, with a warning: the project itself still imports.
 */
export function importProjectTrace(projectId: string, value: unknown): boolean {
  const problem = traceFileProblem(value);
  if (problem) {
    console.warn(`The imported project's trace is unusable (${problem}); importing the project without it.`);
    toast.warn(i18n.t('traceability.toasts.importedTraceUnusable', { problem }));
    return false;
  }
  replaceProjectTrace(projectId, { ...(value as TraceFile), projectId });
  return true;
}

export function deleteProjectTrace(projectId: string): void {
  cache.delete(projectId);
  localStorage.removeItem(traceKey(projectId));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The project trace, re-rendering when it changes. */
export function useProjectTrace(projectId: string | undefined): TraceFile | null {
  return useSyncExternalStore(subscribe, () => (projectId ? getProjectTrace(projectId) : null));
}

/** Record the edits between two versions of a class diagram, when the project records traces. */
export function recordClassDiagramUpdate(
  project: BesserProject,
  diagram: ProjectDiagram,
  previousModel: unknown,
  nextModel: unknown,
  source: ModellingSource,
): void {
  if (!isTraceabilityEnabled(project)) return;
  const changes = diffClassModel(previousModel as ClassModelLike, nextModel as ClassModelLike);
  if (changes.length === 0) return;
  updateProjectTrace(project.id, (trace) =>
    recordElementChanges(trace, changes, {
      diagramId: diagram.id,
      diagramTitle: diagram.title,
      actorName: traceActorName(project),
      source,
      now: new Date().toISOString(),
    }),
  );
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
  const diagram = findModelArtifact(getProjectTrace(project.id), diagramId);
  if (!diagram || diagram.parentId) return;
  updateProjectTrace(project.id, (trace) =>
    recordElementChanges(
      trace,
      [{ ...change, elementId: diagramId, elementType: diagram.elementType, name: title, parentElementId: null }],
      { diagramId, diagramTitle: title, actorName: traceActorName(project), source: 'MANUAL_MODELLING', now: new Date().toISOString() },
    ),
  );
}

export function recordDiagramRenamed(project: BesserProject, diagramId: string, oldTitle: string, newTitle: string): void {
  if (oldTitle.trim() === newTitle.trim()) return;
  recordDiagramChange(project, diagramId, newTitle, { kind: 'UPDATED', feature: 'name', oldValue: oldTitle, newValue: newTitle });
}

export function recordDiagramDeleted(project: BesserProject, diagramId: string, title: string): void {
  recordDiagramChange(project, diagramId, title, { kind: 'DELETED', oldValue: title });
}

/** Merge the trace fragment of a generation run into the project trace. */
export function recordGenerationTrace(projectId: string, fragment: TraceFile): void {
  updateProjectTrace(projectId, (trace) => mergeTraceFragment(trace, fragment));
}
