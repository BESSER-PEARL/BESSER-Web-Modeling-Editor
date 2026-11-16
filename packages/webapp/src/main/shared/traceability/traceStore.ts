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
import { DIAGRAM_MODEL_TYPES, diffDiagramModel, snapshotDiagramModel } from './diagramModelDiff';
import { diffGuiModel, guiBindings, pageSources } from './guiModelDiff';
import type { GuiModelLike } from './guiModelDiff';
import type { ElementChange } from './modelDiff';
import { indexedDbTraceStorage, memoryTraceStorage } from './traceDatabase';
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
  const value = migrateTraceFile(imported);
  const problem = traceFileProblem(value);
  if (problem) {
    console.warn(`The imported project's trace is unusable (${problem}); importing the project without it.`);
    toast.warn(i18n.t('traceability.toasts.importedTraceUnusable', { problem }));
    return undefined;
  }
  return value as TraceFile;
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
  const changes = diffDiagramModel(diagramType, previousModel, nextModel, diagram.id);
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
    recordElementChanges(trace, changes, ctx);
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
