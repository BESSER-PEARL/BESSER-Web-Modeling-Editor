import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { store } from '../../../app/store/store';
import {
  loadProjectThunk,
  switchDiagramIndexThunk,
  switchDiagramTypeThunk,
  updateDiagramModelThunk,
} from '../../../app/store/workspaceSlice';
import type { LabDone, LabThreadItem } from '../../../shared/api/lab';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { MAX_DIAGRAMS_PER_TYPE, type BesserProject } from '../../../shared/types/project';
import { consumeAutoLayoutRequest } from '../../../shared/utils/autoLayoutSignal';
import {
  applyLabRevision,
  discardLabProposal,
  dismissLabRevision,
  handleLabDone,
  keepLabProposal,
  labChangeModelPayload,
  labProposalChangeId,
  labRevisionOf,
  openLabChangeProject,
} from '../labDone';
import { createLabProject, labProjectId } from '../labProject';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), update: vi.fn() },
}));

/** An editor class diagram as the backend's class-diagram converter returns it. */
function classModel(...classNames: string[]) {
  const elements = Object.fromEntries(
    classNames.map((name) => [
      `id-${name}`,
      { id: `id-${name}`, name, type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 160, height: 100 }, attributes: [], methods: [] },
    ]),
  );
  return { version: '3.0.0', type: 'ClassDiagram', size: { width: 0, height: 0 }, interactive: { elements: {}, relationships: {} }, elements, relationships: {}, assessments: {} };
}

function labDone(changeId: string, proposal: LabDone['modelProposal']): LabDone {
  return {
    step: 'plan',
    changeId,
    title: 'Note element',
    kind: 'metamodel',
    plan: null,
    modelProposal: proposal,
    repoChanges: [],
    checks: [],
    checklist: [],
    summary: '',
    stopReason: 'completed',
    finalText: '',
    report: null,
    pullRequests: [],
    cost: { usd: 0, turns: 0, elapsedSeconds: 0, runs: 0 },
    issues: [],
    noteProposals: [],
  };
}

const proposalOf = (title: string, ...classNames: string[]): LabDone['modelProposal'] => ({
  title,
  diagramType: 'ClassDiagram',
  model: classModel(...classNames),
});

const stored = (): BesserProject => ProjectStorageRepository.loadProject(store.getState().workspace.project!.id)!;
const classNamesOf = (model: unknown): string[] =>
  Object.values((model as { elements: Record<string, { name: string }> }).elements).map((element) => element.name);

describe('handleLabDone in a browser without the change project', () => {
  it("makes the change's own project and puts the proposal in its empty class diagram", async () => {
    localStorage.clear();
    // Precondition: nothing has been loaded into the store in this file yet.
    expect(store.getState().workspace.project).toBeNull();
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));

    expect(toast.error).not.toHaveBeenCalled();
    const project = ProjectStorageRepository.loadProject(labProjectId('c1'))!;
    expect(project.name).toBe('Note element');
    expect(project.diagrams.ClassDiagram.map((diagram) => diagram.title)).toEqual(['Note metamodel']);
    expect(labProposalChangeId(project.diagrams.ClassDiagram[0])).toBe('c1');
    expect(store.getState().workspace.project?.id).toBe(labProjectId('c1'));
    expect(store.getState().workspace.activeDiagram?.id).toBe(project.diagrams.ClassDiagram[0].id);
  });
});

describe('handleLabDone', () => {
  let projectId: string;

  beforeEach(async () => {
    localStorage.clear();
    vi.mocked(toast.error).mockClear();
    consumeAutoLayoutRequest();
    const project = createLabProject('c1', 'Note element', 'ana');
    // A diagram the user drew in the change's project: a proposal never replaces it.
    project.diagrams.ClassDiagram[0] = { ...project.diagrams.ClassDiagram[0], model: classModel('Mine') as never };
    ProjectStorageRepository.saveProject(project);
    projectId = project.id;
    await store.dispatch(loadProjectThunk(projectId)).unwrap();
    // The user is elsewhere when the run ends.
    await store.dispatch(switchDiagramTypeThunk({ diagramType: 'StateMachineDiagram' })).unwrap();
  });

  it('opens the proposal as a new class diagram tab, makes it active and asks for a layout', async () => {
    const revision = store.getState().workspace.editorRevision;
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note', 'Page')));

    const diagrams = stored().diagrams.ClassDiagram;
    expect(diagrams.map((diagram) => diagram.title)).toEqual(['Class Diagram', 'Note metamodel']);
    expect(classNamesOf(diagrams[1].model)).toEqual(['Note', 'Page']);
    expect(labProposalChangeId(diagrams[1])).toBe('c1');
    expect(labProposalChangeId(diagrams[0])).toBeNull();

    const workspace = store.getState().workspace;
    expect(workspace.activeDiagramType).toBe('ClassDiagram');
    expect(workspace.activeDiagramIndex).toBe(1);
    expect(workspace.activeDiagram?.id).toBe(diagrams[1].id);
    expect(workspace.editorRevision).toBeGreaterThan(revision);
    expect(consumeAutoLayoutRequest()).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("replaces the same change's earlier proposal, and puts another change's in that change's own project", async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    const firstId = stored().diagrams.ClassDiagram[1].id;
    await handleLabDone(labDone('c1', proposalOf('Note metamodel v2', 'Note', 'Tag')));

    const diagrams = stored().diagrams.ClassDiagram;
    expect(diagrams).toHaveLength(2);
    expect(diagrams[1]).toMatchObject({ id: firstId, title: 'Note metamodel v2' });
    expect(classNamesOf(diagrams[1].model)).toEqual(['Note', 'Tag']);

    await handleLabDone(labDone('c2', proposalOf('Petri net', 'Place')));
    expect(store.getState().workspace.project?.id).toBe(labProjectId('c2'));
    const other = ProjectStorageRepository.loadProject(labProjectId('c2'))!.diagrams.ClassDiagram;
    expect(other.map((diagram) => labProposalChangeId(diagram))).toEqual(['c2']);
    const own = ProjectStorageRepository.loadProject(projectId)!.diagrams.ClassDiagram;
    expect(own.map((diagram) => labProposalChangeId(diagram))).toEqual([null, 'c1']);
  });

  it("once kept, the diagram is the user's: the change's next proposal opens a new tab", async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    const keptId = stored().diagrams.ClassDiagram[1].id;
    await keepLabProposal(keptId);

    // No longer a proposal, but still the model of its change.
    expect(stored().diagrams.ClassDiagram[1].config).toEqual({ labChangeId: 'c1' });
    // The editor saves from the store's copy, so the store must lose the marker too.
    expect(labProposalChangeId(store.getState().workspace.activeDiagram)).toBeNull();

    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note', 'Tag')));
    const diagrams = stored().diagrams.ClassDiagram;
    expect(diagrams).toHaveLength(3);
    expect(classNamesOf(diagrams[1].model)).toEqual(['Note']);
    expect(labProposalChangeId(diagrams[2])).toBe('c1');
  });

  it("hands a build the change's own class diagram, pending or kept, never another one", async () => {
    const payloadIds = (changeId: string) => {
      const payload = labChangeModelPayload(stored(), changeId) as { diagrams: Record<string, { id: string }[]> } | null;
      return payload?.diagrams.ClassDiagram.map((diagram) => diagram.id) ?? null;
    };
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    const [userDiagram, proposal] = stored().diagrams.ClassDiagram;
    // The user's own diagram becomes active again; it is still not what the build reads.
    await store.dispatch(switchDiagramIndexThunk({ diagramType: 'ClassDiagram', index: 0 })).unwrap();
    expect(store.getState().workspace.activeDiagram?.id).toBe(userDiagram.id);
    expect(payloadIds('c1')).toEqual([proposal.id]);

    await keepLabProposal(proposal.id);
    expect(payloadIds('c1')).toEqual([proposal.id]);
    expect(payloadIds('c2')).toBeNull();
    expect(payloadIds('')).toBeNull();
    expect(userDiagram.id).not.toBe(proposal.id);
  });

  it('keeps the proposal pending while the user edits it on the canvas', async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    await store.dispatch(updateDiagramModelThunk({ model: classModel('Note', 'Mine') as never })).unwrap();

    const proposal = stored().diagrams.ClassDiagram[1];
    expect(classNamesOf(proposal.model)).toEqual(['Note', 'Mine']);
    expect(labProposalChangeId(proposal)).toBe('c1');
  });

  // E2E A-1: the user renamed a class in the proposal while the revision was being planned, and the revision
  // silently replaced the tab, edit and all.
  it('keeps an edit made while the run was in progress and holds the revision for the banner', async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    const sent = stored().diagrams.ClassDiagram[1].model;
    await store.dispatch(updateDiagramModelThunk({ model: classModel('Note', 'Mine') as never })).unwrap();

    await handleLabDone(labDone('c1', proposalOf('Note metamodel v2', 'Note', 'Tag')), sent);

    const proposal = stored().diagrams.ClassDiagram[1];
    expect(classNamesOf(proposal.model)).toEqual(['Note', 'Mine']);
    expect(proposal.title).toBe('Note metamodel');
    expect(labProposalChangeId(proposal)).toBe('c1');
    expect(labRevisionOf(proposal)?.title).toBe('Note metamodel v2');
    expect(classNamesOf(labRevisionOf(proposal)?.model)).toEqual(['Note', 'Tag']);
    // The store has the revision too, so the banner shows it without a reload.
    expect(labRevisionOf(store.getState().workspace.activeDiagram)).not.toBeNull();
  });

  it('applies the revision when the diagram is as the request carried it, edits made before it included', async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    await store.dispatch(updateDiagramModelThunk({ model: classModel('Note', 'Mine') as never })).unwrap();
    const sent = stored().diagrams.ClassDiagram[1].model;
    // Moving a class is not an edit.
    const moved = classModel('Note', 'Mine');
    moved.elements['id-Note'].bounds = { x: 400, y: 300, width: 160, height: 100 };
    await store.dispatch(updateDiagramModelThunk({ model: moved as never })).unwrap();

    await handleLabDone(labDone('c1', proposalOf('Note metamodel v2', 'Note', 'Mine', 'Tag')), sent);

    const proposal = stored().diagrams.ClassDiagram[1];
    expect(classNamesOf(proposal.model)).toEqual(['Note', 'Mine', 'Tag']);
    expect(labRevisionOf(proposal)).toBeNull();
  });

  it('after a reload, does not replace a proposal the user changed since it was placed', async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    await store.dispatch(updateDiagramModelThunk({ model: classModel('Note', 'Mine') as never })).unwrap();

    // A run followed after a reload: what its request carried is not known.
    await handleLabDone(labDone('c1', proposalOf('Note metamodel v2', 'Note', 'Tag')));

    const proposal = stored().diagrams.ClassDiagram[1];
    expect(classNamesOf(proposal.model)).toEqual(['Note', 'Mine']);
    expect(classNamesOf(labRevisionOf(proposal)?.model)).toEqual(['Note', 'Tag']);
  });

  it('the held revision replaces the user version on request, or is dropped', async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    const sent = stored().diagrams.ClassDiagram[1].model;
    await store.dispatch(updateDiagramModelThunk({ model: classModel('Note', 'Mine') as never })).unwrap();
    await handleLabDone(labDone('c1', proposalOf('Note metamodel v2', 'Note', 'Tag')), sent);
    const id = stored().diagrams.ClassDiagram[1].id;

    await dismissLabRevision(id);
    let proposal = stored().diagrams.ClassDiagram[1];
    expect(classNamesOf(proposal.model)).toEqual(['Note', 'Mine']);
    expect(labRevisionOf(proposal)).toBeNull();
    expect(labProposalChangeId(proposal)).toBe('c1');

    await handleLabDone(labDone('c1', proposalOf('Note metamodel v3', 'Note', 'Tag')), sent);
    consumeAutoLayoutRequest();
    await applyLabRevision(id);
    proposal = stored().diagrams.ClassDiagram[1];
    expect(proposal).toMatchObject({ id, title: 'Note metamodel v3' });
    expect(classNamesOf(proposal.model)).toEqual(['Note', 'Tag']);
    expect(labRevisionOf(proposal)).toBeNull();
    expect(labProposalChangeId(proposal)).toBe('c1');
    expect(consumeAutoLayoutRequest()).toBe(true);
  });

  it('changes nothing when the run proposes no model', async () => {
    const before = JSON.stringify(stored());
    await handleLabDone(labDone('c1', null));
    expect(JSON.stringify(stored())).toBe(before);
    expect(consumeAutoLayoutRequest()).toBe(false);
  });

  it('refuses a model that is not a class diagram', async () => {
    await handleLabDone(
      labDone('c1', { title: 'Odd', diagramType: 'ClassDiagram', model: { ...classModel('Note'), type: 'StateMachineDiagram' } }),
    );
    expect(toast.error).toHaveBeenCalledWith('The lab agent proposed a model the editor cannot open as a class diagram.');
    expect(stored().diagrams.ClassDiagram).toHaveLength(1);
  });

  it('says so when the project already holds the most class diagrams it can', async () => {
    const project = stored();
    while (project.diagrams.ClassDiagram.length < MAX_DIAGRAMS_PER_TYPE) {
      project.diagrams.ClassDiagram.push({ ...project.diagrams.ClassDiagram[0], id: `full-${project.diagrams.ClassDiagram.length}` });
    }
    ProjectStorageRepository.saveProject(project);

    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    expect(toast.error).toHaveBeenCalledWith(
      `The proposed model was not opened: the project already has ${MAX_DIAGRAMS_PER_TYPE} class diagrams.`,
    );
    expect(stored().diagrams.ClassDiagram.every((diagram) => labProposalChangeId(diagram) === null)).toBe(true);
  });

  it("discarding closes the proposal's tab and leaves the user's diagrams", async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    await discardLabProposal(stored().diagrams.ClassDiagram[1].id);

    const diagrams = stored().diagrams.ClassDiagram;
    expect(diagrams.map((diagram) => diagram.title)).toEqual(['Class Diagram']);
    expect(store.getState().workspace.project?.diagrams.ClassDiagram).toHaveLength(1);
  });

  it("discarding the project's only class diagram empties it instead", async () => {
    await handleLabDone(labDone('c1', proposalOf('Note metamodel', 'Note')));
    ProjectStorageRepository.removeDiagram(projectId, 'ClassDiagram', 0);
    await store.dispatch(loadProjectThunk(projectId)).unwrap();
    const only = stored().diagrams.ClassDiagram[0];

    await discardLabProposal(only.id);
    const diagrams = stored().diagrams.ClassDiagram;
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].id).toBe(only.id);
    expect(classNamesOf(diagrams[0].model)).toEqual([]);
    expect(labProposalChangeId(diagrams[0])).toBeNull();
  });
});

// D4 test 10 (canvas part): another browser opens the change; its project is rebuilt from the thread.
describe('openLabChangeProject', () => {
  const planRun = (at: number, ...classNames: string[]): LabThreadItem => ({
    type: 'run',
    runId: `r${at}`,
    at,
    login: 'jordi',
    status: 'done',
    lab: labDone('c1', proposalOf('Note metamodel', ...classNames)),
    error: null,
    costUsd: 0.4,
    planVersion: 1,
  });
  const message = (at: number, ...classNames: string[]): LabThreadItem => ({
    type: 'message',
    id: `m${at}`,
    at,
    login: 'ana',
    text: 'Build it',
    action: 'build',
    model: classModel(...classNames),
  });
  const CHANGE = { changeId: 'c1', title: 'Note element', owner: 'jordi' };

  beforeEach(() => {
    localStorage.clear();
    consumeAutoLayoutRequest();
  });

  it("rebuilds the last plan's proposal, pending, when it is newer than the last message's model", async () => {
    await openLabChangeProject(CHANGE, [message(100, 'Old'), planRun(200, 'Note', 'Tag')]);
    const [diagram, ...rest] = ProjectStorageRepository.loadProject(labProjectId('c1'))!.diagrams.ClassDiagram;
    expect(rest).toEqual([]);
    expect(diagram.title).toBe('Note metamodel');
    expect(classNamesOf(diagram.model)).toEqual(['Note', 'Tag']);
    expect(labProposalChangeId(diagram)).toBe('c1');
    expect(store.getState().workspace.project?.id).toBe(labProjectId('c1'));
    expect(consumeAutoLayoutRequest()).toBe(true);
  });

  it("rebuilds the last message's model, as the change's kept model, when it is newer", async () => {
    await openLabChangeProject(CHANGE, [planRun(100, 'Note'), message(200, 'Note', 'Mine')]);
    const project = ProjectStorageRepository.loadProject(labProjectId('c1'))!;
    const [diagram] = project.diagrams.ClassDiagram;
    expect(classNamesOf(diagram.model)).toEqual(['Note', 'Mine']);
    expect(labProposalChangeId(diagram)).toBeNull();
    expect(diagram.config).toEqual({ labChangeId: 'c1' });
    // It is what the next build reads.
    expect(labChangeModelPayload(project, 'c1')).not.toBeNull();
  });

  it('keeps the project this browser already has, edits and all', async () => {
    await openLabChangeProject(CHANGE, [planRun(100, 'Note')]);
    await store.dispatch(updateDiagramModelThunk({ model: classModel('Note', 'Edited') as never })).unwrap();
    await openLabChangeProject(CHANGE, [planRun(100, 'Note'), planRun(300, 'Other')]);
    expect(classNamesOf(stored().diagrams.ClassDiagram[0].model)).toEqual(['Note', 'Edited']);
  });

  it('opens an empty project for a change whose thread has no model', async () => {
    await openLabChangeProject(CHANGE, []);
    const project = ProjectStorageRepository.loadProject(labProjectId('c1'))!;
    expect(project.name).toBe('Note element');
    expect(labChangeModelPayload(project, 'c1')).toBeNull();
  });
});
