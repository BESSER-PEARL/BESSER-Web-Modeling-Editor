import { beforeEach, describe, expect, it } from 'vitest';
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
  const wrapper = Object.assign(new FakeComponent({ type: 'wrapper', id: 'wrapper' }), { find: () => components });
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
});
