/**
 * An assistant edit must be one Ctrl+Z step, not a reset of the user's undo
 * history. `editor.model = …` is a model swap: the editor clears its undo
 * manager, so every hand edit made before the assistant reply was lost.
 * `BesserEditor.applyModel(model)` records the change as one undoable step;
 * the service must prefer it and keep the setter only for editor builds
 * without it.
 */
import { describe, expect, it, vi } from 'vitest';

import { UMLModelingService } from '../UMLModelingService';

const model = (names: string[]): any => ({
  version: '4.0.0',
  id: 'd',
  title: '',
  type: 'ClassDiagram',
  nodes: names.map((name, i) => ({
    id: name, type: 'class', position: { x: i * 300, y: 0 }, width: 220, height: 90,
    data: { name, attributes: [], methods: [] },
  })),
  edges: [],
  assessments: {},
});

function editorWith(applyModel?: (m: any) => void) {
  const setModel = vi.fn();
  const editor: any = { ready: Promise.resolve(), ...(applyModel ? { applyModel } : {}) };
  Object.defineProperty(editor, 'model', { get: () => undefined, set: setModel, configurable: true });
  return { editor, setModel };
}

const dispatch: any = vi.fn(() => ({ unwrap: () => Promise.resolve() }));

describe('UMLModelingService — assistant edits keep the undo history', () => {
  it('injectToEditor applies the change once through applyModel, never the history-clearing setter', async () => {
    const applyModel = vi.fn();
    const { editor, setModel } = editorWith(applyModel);
    const service = new UMLModelingService(editor, dispatch);
    service.updateCurrentModel(model(['A']));

    await service.injectToEditor({ type: 'modification', data: model(['A', 'B']), message: '' });

    expect(applyModel).toHaveBeenCalledTimes(1);
    expect(applyModel.mock.calls[0][0].nodes.map((n: any) => n.id)).toEqual(['A', 'B']);
    expect(setModel).not.toHaveBeenCalled();
  });

  it('replaceModel goes through applyModel too', async () => {
    const applyModel = vi.fn();
    const { editor, setModel } = editorWith(applyModel);
    const service = new UMLModelingService(editor, dispatch);
    service.updateCurrentModel(model(['A']));

    await service.replaceModel(model(['C']));

    expect(applyModel).toHaveBeenCalledTimes(1);
    expect(setModel).not.toHaveBeenCalled();
  });

  it('falls back to the model setter on an editor build without applyModel', async () => {
    const { editor, setModel } = editorWith();
    const service = new UMLModelingService(editor, dispatch);
    service.updateCurrentModel(model(['A']));

    await service.injectToEditor({ type: 'modification', data: model(['A', 'B']), message: '' });

    expect(setModel).toHaveBeenCalledTimes(1);
  });
});
