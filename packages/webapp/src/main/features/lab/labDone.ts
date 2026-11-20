/**
 * The class diagram the lab agent proposes for a metamodel or diagram-type change.
 *
 * It opens as its own ClassDiagram tab of the current project, marked as a proposal of
 * its change (`config.labProposalChangeId`, stored with the project), until the user
 * keeps or discards it. A later proposal of the same change replaces that tab, unless
 * the user edited the tab while the run was in progress: then the user's version stays
 * and the revision waits in `config.labRevision` for the banner. Once kept, the diagram
 * is the user's (`config.labChangeId` remembers its change) and a later proposal opens
 * a new tab.
 */
import { UMLDiagramType } from '@besser/wme';
import { store } from '../../app/store/store';
import { loadProjectThunk, refreshProjectStateThunk, removeDiagramThunk } from '../../app/store/workspaceSlice';
import type { LabDone } from '../../shared/api/lab';
import i18n from '../../shared/i18n';
import { reportError } from '../../shared/services/errors/reportError';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { recordDiagramCreated, recordDiagramRenamed, recordDiagramUpdate } from '../../shared/traceability/traceStore';
import {
  createEmptyDiagram,
  isUMLModel,
  MAX_DIAGRAMS_PER_TYPE,
  type BesserProject,
  type ProjectDiagram,
} from '../../shared/types/project';
import { requestAutoLayoutOnNextSetup } from '../../shared/utils/autoLayoutSignal';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';

const PROPOSAL_MARKER = 'labProposalChangeId';
/** A kept proposal: still its change's model (BESSER `model_proposal._change_diagram` reads both markers). */
const KEPT_MARKER = 'labChangeId';
/** The content of the proposal as placed: tells, after a reload, whether the user has edited it since. */
const PLACED_MARKER = 'labProposalContent';
/** A revised proposal held back because the user edited the tab while the run was in progress. */
const REVISION_MARKER = 'labRevision';

const marker = (diagram: ProjectDiagram | null | undefined, name: string): string | null => {
  const changeId = diagram?.config?.[name];
  return typeof changeId === 'string' ? changeId : null;
};

/** The lab change whose pending model proposal `diagram` is, or null when it is not one. */
export function labProposalChangeId(diagram: ProjectDiagram | null | undefined): string | null {
  return marker(diagram, PROPOSAL_MARKER);
}

type ModelProposal = NonNullable<LabDone['modelProposal']>;

/** The revised proposal waiting on `diagram` for the user to take or leave, or null. */
export function labRevisionOf(diagram: ProjectDiagram | null | undefined): ModelProposal | null {
  const revision = diagram?.config?.[REVISION_MARKER] as ModelProposal | undefined;
  return revision && typeof revision === 'object' && isUMLModel(revision.model) ? revision : null;
}

const ELEMENT_FIELDS = ['type', 'name', 'owner', 'visibility', 'attributeType', 'isOptional', 'isId', 'isDerived', 'defaultValue'];
const END_FIELDS = ['element', 'role', 'multiplicity'];

/**
 * What a class diagram says, without where it is drawn: moving or laying out classes
 * is not an edit. Missing and empty values count the same.
 */
function modelContent(model: unknown): string {
  type Item = Record<string, unknown> & { source?: Record<string, unknown>; target?: Record<string, unknown> };
  const { elements = {}, relationships = {} } = (model ?? {}) as { elements?: Record<string, Item>; relationships?: Record<string, Item> };
  const pick = (item: Record<string, unknown> | undefined, fields: string[]) => fields.map((field) => item?.[field] || '');
  return [
    ...Object.values(elements).map((element) => JSON.stringify([element.id, ...pick(element, ELEMENT_FIELDS)])),
    ...Object.values(relationships).map((relationship) =>
      JSON.stringify([
        relationship.id,
        ...pick(relationship, ['type', 'name']),
        ...pick(relationship.source, END_FIELDS),
        ...pick(relationship.target, END_FIELDS),
      ]),
    ),
  ]
    .sort()
    .join('\n');
}

/** `diagram` without the proposal's markers (and without `config` when nothing else was in it). */
function settled(diagram: ProjectDiagram): ProjectDiagram {
  const { config, ...rest } = diagram;
  const kept = { ...config };
  delete kept[PROPOSAL_MARKER];
  delete kept[PLACED_MARKER];
  delete kept[REVISION_MARKER];
  return Object.keys(kept).length > 0 ? { ...rest, config: kept } : rest;
}

/** `diagram` holding `proposal` as change `changeId`'s pending proposal. */
function placed(diagram: ProjectDiagram, proposal: ModelProposal, changeId: string): ProjectDiagram {
  const { config, ...rest } = settled(diagram);
  return {
    ...rest,
    title: proposal.title,
    model: proposal.model as ProjectDiagram['model'],
    config: { ...config, [PROPOSAL_MARKER]: changeId, [PLACED_MARKER]: modelContent(proposal.model) },
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * Whether the user changed `diagram` while the run was in progress: since `sentModel`, the
 * model the request carried, or, when that is unknown (the run was followed after a reload),
 * since the proposal was placed. Edits made before the request are in the revision.
 */
function editedDuringRun(diagram: ProjectDiagram, sentModel: unknown): boolean {
  const current = modelContent(diagram.model);
  if (sentModel != null) return current !== modelContent(sentModel);
  const placedContent = marker(diagram, PLACED_MARKER);
  return placedContent !== null && current !== placedContent;
}

/**
 * The project reduced to the class diagram of change `changeId` (its pending proposal,
 * else the one the user kept), as the lab's build step reads it; null when there is none.
 */
export function labChangeModelPayload(project: BesserProject, changeId: string): Record<string, unknown> | null {
  if (!changeId) return null;
  const diagrams = project.diagrams.ClassDiagram ?? [];
  const diagram =
    diagrams.find((candidate) => marker(candidate, PROPOSAL_MARKER) === changeId) ??
    [...diagrams].reverse().find((candidate) => marker(candidate, KEPT_MARKER) === changeId);
  if (!diagram) return null;
  const reduced: BesserProject = {
    ...project,
    diagrams: { ...project.diagrams, ClassDiagram: [diagram] },
    currentDiagramIndices: { ...project.currentDiagramIndices, ClassDiagram: 0 },
  };
  return buildProjectPayloadForBackend(reduced, ['ClassDiagram']);
}

/** The open project as stored, or null when no project is open. */
function openProject(): BesserProject | null {
  const projectId = store.getState().workspace.project?.id;
  return projectId ? ProjectStorageRepository.loadProject(projectId) : null;
}

/**
 * Handles the `lab` payload of a lab run's `done` event: a model proposal opens as a
 * ClassDiagram tab titled with its title (the same change's earlier proposal is
 * replaced), becomes the active diagram and is laid out when the canvas opens. When the
 * user edited that tab while the run was in progress, their version stays and the
 * proposal waits as a revision the banner offers. `sentModel` is the change's model
 * the run's request carried, when known. Failures are reported to the user; this never throws.
 */
export async function handleLabDone(lab: LabDone, sentModel?: unknown): Promise<void> {
  const proposal = lab.modelProposal;
  if (!proposal) return;
  const project = openProject();
  if (!project) {
    reportError(
      i18n.t('lab.proposal.errors.noProject', {
        defaultValue: 'Open a project to see the class diagram the lab agent proposes.',
      }),
    );
    return;
  }
  if (!isUMLModel(proposal.model) || proposal.model.type !== UMLDiagramType.ClassDiagram) {
    reportError(
      i18n.t('lab.proposal.errors.invalidModel', {
        defaultValue: 'The lab agent proposed a model the editor cannot open as a class diagram.',
      }),
    );
    return;
  }

  const diagrams = project.diagrams.ClassDiagram;
  let index = diagrams.findIndex((diagram) => labProposalChangeId(diagram) === lab.changeId);
  const previous = index >= 0 ? diagrams[index] : undefined;
  if (previous && editedDuringRun(previous, sentModel)) {
    await holdRevision(project, index, proposal);
    return;
  }
  if (index < 0) {
    if (diagrams.length >= MAX_DIAGRAMS_PER_TYPE) {
      reportError(
        i18n.t('lab.proposal.errors.limitReached', {
          defaultValue: 'The proposed model was not opened: the project already has {{max}} class diagrams.',
          max: MAX_DIAGRAMS_PER_TYPE,
        }),
      );
      return;
    }
    diagrams.push(createEmptyDiagram(proposal.title, UMLDiagramType.ClassDiagram));
    index = diagrams.length - 1;
  }
  try {
    await openProposal(project, index, placed(diagrams[index], proposal, lab.changeId), previous);
  } catch (error) {
    console.error('[lab] could not open the proposed model:', error);
    reportError(
      i18n.t('lab.proposal.errors.failed', { defaultValue: 'The proposed model could not be opened.' }),
      { error },
    );
  }
}

/** Saves `proposal` as diagram `index` of `project`, makes it active and lays it out when the canvas opens. */
async function openProposal(
  project: BesserProject,
  index: number,
  proposal: ProjectDiagram,
  previous: ProjectDiagram | undefined,
): Promise<void> {
  project.diagrams.ClassDiagram[index] = proposal;
  project.currentDiagramType = 'ClassDiagram';
  project.currentDiagramIndices.ClassDiagram = index;
  ProjectStorageRepository.withoutNotify(() => ProjectStorageRepository.saveProject(project));
  if (previous) {
    recordDiagramUpdate(project, 'ClassDiagram', proposal, previous.model, proposal.model, 'assistant');
    if (previous.title !== proposal.title) recordDiagramRenamed(project, proposal.id, previous.title, proposal.title);
  } else {
    recordDiagramCreated(project, 'ClassDiagram', proposal, 'assistant');
  }
  // The proposal has no layout of its own: ELK arranges it when the canvas opens.
  requestAutoLayoutOnNextSetup();
  await store.dispatch(loadProjectThunk(project.id)).unwrap();
}

/**
 * Keeps the user's diagram `index` as it is and holds `proposal` on it for the banner. The
 * diagram becomes active; when it already is, the canvas is not remounted, so the user's
 * editing is not interrupted.
 */
async function holdRevision(project: BesserProject, index: number, proposal: ModelProposal): Promise<void> {
  const diagram = project.diagrams.ClassDiagram[index];
  const held: ProjectDiagram = { ...diagram, config: { ...diagram.config, [REVISION_MARKER]: proposal } };
  project.diagrams.ClassDiagram[index] = held;
  project.currentDiagramType = 'ClassDiagram';
  project.currentDiagramIndices.ClassDiagram = index;
  try {
    ProjectStorageRepository.withoutNotify(() => ProjectStorageRepository.saveProject(project));
    if (store.getState().workspace.activeDiagram?.id === diagram.id) {
      await store.dispatch(refreshProjectStateThunk()).unwrap();
    } else {
      await store.dispatch(loadProjectThunk(project.id)).unwrap();
    }
  } catch (error) {
    console.error('[lab] could not hold the revised proposal:', error);
    reportError(
      i18n.t('lab.proposal.errors.failed', { defaultValue: 'The proposed model could not be opened.' }),
      { error },
    );
  }
}

/** Replaces the user's version in diagram `diagramId` with the revision waiting on it. */
export async function applyLabRevision(diagramId: string): Promise<void> {
  const project = openProject();
  const index = project?.diagrams.ClassDiagram.findIndex((diagram) => diagram.id === diagramId) ?? -1;
  if (!project || index < 0) return;
  const previous = project.diagrams.ClassDiagram[index];
  const revision = labRevisionOf(previous);
  const changeId = labProposalChangeId(previous);
  if (!revision || !changeId) return;
  await openProposal(project, index, placed(previous, revision, changeId), previous);
}

/** Drops the revision waiting on diagram `diagramId`: the user's version stays the proposal. */
export async function dismissLabRevision(diagramId: string): Promise<void> {
  const project = openProject();
  const index = project?.diagrams.ClassDiagram.findIndex((diagram) => diagram.id === diagramId) ?? -1;
  if (!project || index < 0) return;
  const diagram = project.diagrams.ClassDiagram[index];
  const config = { ...diagram.config };
  delete config[REVISION_MARKER];
  ProjectStorageRepository.withoutNotify(() => {
    ProjectStorageRepository.updateDiagram(project.id, 'ClassDiagram', { ...diagram, config }, index);
  });
  await store.dispatch(refreshProjectStateThunk()).unwrap();
}

/**
 * Keeps the proposal in diagram `diagramId`: it becomes an ordinary class diagram of the project,
 * still the model a build of its change reads.
 */
export async function keepLabProposal(diagramId: string): Promise<void> {
  const project = openProject();
  const index = project?.diagrams.ClassDiagram.findIndex((diagram) => diagram.id === diagramId) ?? -1;
  if (!project || index < 0) return;
  const proposal = project.diagrams.ClassDiagram[index];
  const changeId = labProposalChangeId(proposal);
  const settledDiagram = settled(proposal);
  const kept: ProjectDiagram = changeId
    ? { ...settledDiagram, config: { ...settledDiagram.config, [KEPT_MARKER]: changeId } }
    : settledDiagram;
  ProjectStorageRepository.withoutNotify(() => {
    ProjectStorageRepository.updateDiagram(project.id, 'ClassDiagram', kept, index);
  });
  // The model on the canvas does not change, so the editor is not remounted.
  await store.dispatch(refreshProjectStateThunk()).unwrap();
}

/**
 * Discards the proposal in diagram `diagramId`: its tab is closed, or, when it is the
 * project's only class diagram, emptied.
 */
export async function discardLabProposal(diagramId: string): Promise<void> {
  const project = openProject();
  const diagrams = project?.diagrams.ClassDiagram ?? [];
  const index = diagrams.findIndex((diagram) => diagram.id === diagramId);
  if (!project || index < 0) return;
  if (diagrams.length > 1) {
    await store.dispatch(removeDiagramThunk({ diagramType: 'ClassDiagram', index })).unwrap();
    return;
  }
  const proposed = diagrams[index];
  const emptied: ProjectDiagram = {
    ...settled(proposed),
    model: createEmptyDiagram(proposed.title, UMLDiagramType.ClassDiagram).model,
  };
  ProjectStorageRepository.withoutNotify(() => {
    ProjectStorageRepository.updateDiagram(project.id, 'ClassDiagram', emptied, index);
  });
  // The user discarded the proposal: its classes are deleted by the user.
  recordDiagramUpdate(project, 'ClassDiagram', emptied, proposed.model, emptied.model, 'user');
  await store.dispatch(loadProjectThunk(project.id)).unwrap();
}
