import type { Editor } from 'grapesjs';
import type { BesserProject, ProjectDiagram } from '../../../shared/types/project';
import { isTracedComponent } from '../../../shared/traceability/guiModelDiff';
import type { GuiComponentLike } from '../../../shared/traceability/guiModelDiff';
import { isTraceabilityEnabled, recordGuiDiagramUpdate } from '../../../shared/traceability/traceStore';
import type { GuiChangeSource } from '../../../shared/traceability/traceStore';

/**
 * Records a GUI editor's saves in the project trace (`recordGuiDiagramUpdate`).
 *
 * The trace knows a component by its persistent id (`attributes.id`), so every traced component gets one when
 * it is added or the project loads. Each save is compared with the last one recorded (the baseline, kept in
 * memory): the first is the model as it loaded, ids included, so components that existed before are not
 * recorded as created. A save is the user's unless the assistant loaded the model. While the GUI generator derives
 * the GUI from the class diagram, its saves are held: the last one is recorded when the run ends, compared with
 * the GUI before it, as one session of the generator.
 */
export interface GuiTraceRecorder {
  /** Give every traced component a persistent id and take the editor's model as the baseline. */
  start(): void;
  /** Give a component just added a persistent id when it is traced. */
  added(component: TracedIdTarget): void;
  /** Record what the editor now holds (a model the assistant loaded), ids given first. */
  recordLoaded(project: BesserProject, diagram: ProjectDiagram, source: GuiChangeSource): void;
  /** Record a save of `model` (the editor's project data) to `diagram`. */
  record(project: BesserProject, diagram: ProjectDiagram, model: unknown, source?: GuiChangeSource): void;
  /** The saves until `endDerivation` are the GUI generator's: one run, recorded when it ends. */
  beginDerivation(): void;
  endDerivation(): void;
}

const recorders = new WeakMap<Editor, GuiTraceRecorder>();

/** The part of a GrapesJS component read and written here. */
interface TracedIdTarget {
  get(name: string): unknown;
  getAttributes(): Record<string, unknown>;
  getId(): string;
  addAttributes(attributes: Record<string, unknown>): unknown;
}

/** Give a traced component without a persistent id one: its GrapesJS id, kept in its attributes. */
function ensureTracedId(component: TracedIdTarget): void {
  const traced = isTracedComponent({ type: component.get('type') as string, tagName: component.get('tagName') as string } as GuiComponentLike);
  if (traced && !component.getAttributes().id) component.addAttributes({ id: component.getId() });
}

function ensureAllTracedIds(editor: Editor): void {
  for (const page of editor.Pages?.getAll?.() ?? []) {
    const wrapper = page.getMainComponent?.();
    if (!wrapper) continue;
    for (const component of [wrapper, ...wrapper.find('*')]) ensureTracedId(component);
  }
}

/** The recorder of `editor`, made on first use; `projectOf` reads the project the editor is open on. */
export function guiTraceRecorderOf(editor: Editor, projectOf: () => BesserProject | null = () => null): GuiTraceRecorder {
  let recorder = recorders.get(editor);
  if (recorder) return recorder;
  let baseline: unknown;
  let deriving = 0;
  /** The generator run's last save, recorded when the run ends. */
  let derived: { project: BesserProject; diagram: ProjectDiagram; model: unknown } | undefined;
  recorder = {
    start() {
      const project = projectOf();
      if (!project || !isTraceabilityEnabled(project)) return;
      ensureAllTracedIds(editor);
      baseline = editor.getProjectData();
    },
    added(component) {
      const project = projectOf();
      if (project && isTraceabilityEnabled(project)) ensureTracedId(component);
    },
    recordLoaded(project, diagram, source) {
      if (!isTraceabilityEnabled(project)) return;
      ensureAllTracedIds(editor);
      this.record(project, diagram, editor.getProjectData(), source);
    },
    record(project, diagram, model, source) {
      if (!isTraceabilityEnabled(project)) return;
      if (deriving > 0 && source === undefined) {
        derived = { project, diagram, model };
        return;
      }
      // Without a baseline (the editor never loaded with tracing on) there is nothing to compare with yet.
      if (baseline !== undefined) recordGuiDiagramUpdate(project, diagram, baseline, model, source ?? 'user');
      baseline = model;
    },
    beginDerivation() {
      deriving += 1;
    },
    endDerivation() {
      deriving = Math.max(0, deriving - 1);
      if (deriving > 0 || !derived) return;
      const { project, diagram, model } = derived;
      derived = undefined;
      this.record(project, diagram, model, 'derivation');
    },
  };
  recorders.set(editor, recorder);
  return recorder;
}
