import { beforeEach, describe, expect, it } from 'vitest';
import grapesjs from 'grapesjs';
import type { Editor } from 'grapesjs';
import { guiTraceRecorderOf } from '../guiTraceRecording';
import { flushTraceSaves, loadProjectTrace, setTraceStorage } from '../../../../shared/traceability/traceStore';
import { memoryTraceStorage } from '../../../../shared/traceability/traceDatabase';
import type { BesserProject, ProjectDiagram } from '../../../../shared/types/project';

/** A GrapesJS component, as far as the recorder reads it. */
class FakeComponent {
  constructor(private readonly props: { type?: string; tagName?: string; id: string; attributes?: Record<string, unknown> }) {}
  get(name: string) {
    return name === 'type' ? this.props.type : name === 'tagName' ? this.props.tagName : undefined;
  }
  getAttributes() {
    return this.props.attributes ?? {};
  }
  getId() {
    return this.props.id;
  }
  addAttributes(attributes: Record<string, unknown>) {
    this.props.attributes = { ...this.props.attributes, ...attributes };
  }
  toJSON() {
    return { type: this.props.type, ...(this.props.attributes ? { attributes: this.props.attributes } : {}) };
  }
}

/** A one-page editor holding `components`, its project data built from them as GrapesJS serializes it. */
function fakeEditor(components: FakeComponent[]) {
  const wrapper: FakeComponent = Object.assign(new FakeComponent({ type: 'wrapper', id: 'wrapper' }), {
    onAll: (visit: (component: FakeComponent) => void) => [wrapper, ...components].forEach(visit),
  });
  const editor = {
    Pages: { getAll: () => [{ getMainComponent: () => wrapper }] },
    getProjectData: () => ({
      pages: [{ id: 'p1', name: 'Home', frames: [{ component: { type: 'wrapper', components: components.map((c) => c.toJSON()) } }] }],
    }),
  };
  return editor as unknown as Editor;
}

const project = {
  id: 'p-gui-editor', name: 'Shop', owner: 'Ada', settings: { traceabilityEnabled: true }, currentDiagramIndices: {},
  diagrams: { GUINoCodeDiagram: [{ id: 'gui', title: 'Shop GUI', model: {} }] },
} as unknown as BesserProject;
const diagram = project.diagrams.GUINoCodeDiagram[0] as ProjectDiagram;

describe('recording a GUI editor in the project trace', () => {
  beforeEach(() => setTraceStorage(memoryTraceStorage()));

  it('gives traced components a persistent id and records nothing for the model as it loaded', async () => {
    const table = new FakeComponent({ type: 'table', id: 'i3k9' });
    const heading = new FakeComponent({ type: 'text', id: 'i3l0' });
    const editor = fakeEditor([table, heading]);
    const recorder = guiTraceRecorderOf(editor, () => project);
    recorder.start();
    expect(table.getAttributes()).toEqual({ id: 'i3k9' });
    expect(heading.getAttributes()).toEqual({}); // not traced: no id needed
    recorder.record(project, diagram, editor.getProjectData()); // the first save after loading
    await flushTraceSaves();
    expect((await loadProjectTrace(project.id)).operations).toEqual([]);
  });

  it("records the user's edits, the assistant's model and the generator's derivation", async () => {
    const components: FakeComponent[] = [];
    const editor = fakeEditor(components);
    const recorder = guiTraceRecorderOf(editor, () => project);
    recorder.start();

    components.push(new FakeComponent({ type: 'table', id: 't1' }));
    recorder.added(components[0]);
    recorder.record(project, diagram, editor.getProjectData());

    components.push(new FakeComponent({ type: 'bar-chart', id: 'c1' }));
    recorder.recordLoaded(project, diagram, 'assistant');

    // The generator saves several times in one run: only the last save is recorded, when the run ends.
    recorder.beginDerivation();
    components.push(new FakeComponent({ type: 'form', id: 'f1' }));
    recorder.added(components[2]);
    recorder.record(project, diagram, editor.getProjectData());
    components.splice(0, 1); // the generator replaces the table
    components.push(new FakeComponent({ type: 'menu', id: 'm1' }));
    recorder.added(components[2]);
    recorder.record(project, diagram, editor.getProjectData());
    await flushTraceSaves();
    expect((await loadProjectTrace(project.id)).operations).toHaveLength(2);
    recorder.endDerivation();
    recorder.record(project, diagram, editor.getProjectData()); // a save after the run, with nothing new

    await flushTraceSaves();
    const trace = await loadProjectTrace(project.id);
    expect(trace.operations.map((o) => o.type)).toEqual(['ModelingSession', 'ModelingSession', 'ModelingSession']);
    const actorsOf = (i: number) => trace.operations[i].performedBy.map((id) => trace.actors.find((a) => a.id === id)?.type);
    expect(actorsOf(0)).toEqual(['Person']);
    expect(actorsOf(1)).toEqual(['Person', 'Agent']);
    const run = trace.operations[2];
    expect(trace.tools.find((t) => t.id === run.toolCalls[0].toolId)?.type).toBe('ModelGenerator');
    expect(run.type === 'ModelingSession' && run.changes.map((c) => c.kind)).toEqual(['CREATED', 'CREATED', 'DELETED']);
  });

  it('reads the project through the reader given later, when a save made the recorder first', async () => {
    const table = new FakeComponent({ type: 'table', id: 't1' });
    const editor = fakeEditor([table]);
    guiTraceRecorderOf(editor).record(project, diagram, editor.getProjectData()); // before the load handler ran
    const recorder = guiTraceRecorderOf(editor, () => project);
    recorder.start();
    expect(table.getAttributes()).toEqual({ id: 't1' }); // the reader is used: tracing is on
  });

  it('records edits of components the canvas has not rendered (another page than the one shown)', async () => {
    // A headless editor renders no page, as the GUI editor renders only the page it shows.
    const editor = grapesjs.init({
      headless: true,
      storageManager: false,
      pageManager: {
        pages: [
          { id: 'home', name: 'Home', component: '<table title="Products"></table>' },
          { id: 'orders', name: 'Orders', component: '<table title="Orders"></table>' },
        ],
      },
    });
    const unrenderedProject = {
      ...project, id: 'p-gui-unrendered',
      diagrams: { GUINoCodeDiagram: [{ id: 'gui-unrendered', title: 'Shop GUI', model: {} }] },
    } as unknown as BesserProject;
    const unrenderedDiagram = unrenderedProject.diagrams.GUINoCodeDiagram[0] as ProjectDiagram;
    const recorder = guiTraceRecorderOf(editor, () => unrenderedProject);
    recorder.start();

    const ordersTable = editor.Pages.get('orders')!.getMainComponent().findType('table')[0];
    expect(ordersTable.getAttributes().id).toBeTruthy();
    ordersTable.addAttributes({ title: 'Open orders' });
    recorder.record(unrenderedProject, unrenderedDiagram, editor.getProjectData());

    await flushTraceSaves();
    const trace = await loadProjectTrace(unrenderedProject.id);
    expect(trace.operations).toHaveLength(1);
    const session = trace.operations[0];
    expect(session.type === 'ModelingSession' && session.changes.map((c) => [c.kind, c.feature, c.oldValue, c.newValue])).toEqual([
      ['UPDATED', 'name', 'Orders', 'Open orders'],
    ]);
  });

  it('records nothing for the ids it gives, when a save came before the editor finished loading', async () => {
    const editor = grapesjs.init({
      headless: true,
      storageManager: false,
      pageManager: { pages: [{ id: 'home', name: 'Home', component: '<table title="Products"></table>' }] },
    });
    const earlyProject = {
      ...project, id: 'p-gui-early-save',
      diagrams: { GUINoCodeDiagram: [{ id: 'gui-early-save', title: 'Shop GUI', model: {} }] },
    } as unknown as BesserProject;
    const earlyDiagram = earlyProject.diagrams.GUINoCodeDiagram[0] as ProjectDiagram;
    guiTraceRecorderOf(editor).record(earlyProject, earlyDiagram, editor.getProjectData()); // before `start`
    const recorder = guiTraceRecorderOf(editor, () => earlyProject);
    recorder.start();
    recorder.record(earlyProject, earlyDiagram, editor.getProjectData());
    await flushTraceSaves();
    expect((await loadProjectTrace(earlyProject.id)).operations).toEqual([]);
  });

  it('records what the editor holds when the generator ends, so a later debounced save is not the user’s', async () => {
    const components: FakeComponent[] = [];
    const editor = fakeEditor(components);
    const recorder = guiTraceRecorderOf(editor, () => project);
    recorder.start();
    recorder.beginDerivation();
    components.push(new FakeComponent({ type: 'table', id: 't9' }));
    recorder.endDerivation(); // no save reached the recorder during the run
    recorder.record(project, diagram, editor.getProjectData()); // the auto-save, debounced past the run
    await flushTraceSaves();
    const trace = await loadProjectTrace(project.id);
    expect(trace.operations).toHaveLength(1);
    expect(trace.tools.find((t) => t.id === trace.operations[0].toolCalls[0].toolId)?.type).toBe('ModelGenerator');
  });
});
