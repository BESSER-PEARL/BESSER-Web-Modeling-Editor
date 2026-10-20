/**
 * "Object and GUI diagrams show one class diagram as reference but are built
 * from another." The agent instantiates objects / binds screens from the
 * ACTIVE class tab of its project snapshot, while a new object or GUI tab
 * defaults its `references.ClassDiagram` to the FIRST class tab. With two class
 * tabs and the second active, the object diagram showed (and validated and
 * generated against) the wrong class diagram.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../../app/store/workspaceSlice', () => {
  const tag = (type: string) => vi.fn((arg?: unknown) => ({ type, arg }));
  return {
    updateDiagramModelThunk: tag('updateDiagramModel'),
    switchDiagramIndexThunk: tag('switchDiagramIndex'),
    addDiagramThunk: tag('addDiagram'),
    addAndSwitchDiagramThunk: tag('addAndSwitchDiagram'),
    bumpEditorRevision: tag('bumpEditorRevision'),
    updateDiagramReferencesThunk: tag('updateDiagramReferences'),
  };
});

import { useModelInjection } from '../useModelInjection';

const project = (objectRefs: Record<string, string> = { ClassDiagram: 'class-1' }) => ({
  diagrams: {
    ClassDiagram: [{ id: 'class-1', title: 'Library' }, { id: 'class-2', title: 'Hotel' }],
    ObjectDiagram: [{ id: 'obj-1', title: 'Objects', references: objectRefs }],
  },
  currentDiagramIndices: { ClassDiagram: 1, ObjectDiagram: 0 },
});

const objectSpec = {
  objects: [{ objectName: 'h1', className: 'Hotel', attributes: [] }],
  links: [],
};

function setup(currentProject: any, currentType = 'ObjectDiagram') {
  const dispatched: any[] = [];
  const dispatch: any = vi.fn((action: any) => {
    dispatched.push(action);
    const result =
      action?.type === 'addAndSwitchDiagram'
        ? { diagramType: 'ObjectDiagram', index: 1, diagram: { id: 'obj-2', references: { ClassDiagram: 'class-1' } } }
        : undefined;
    return { unwrap: () => Promise.resolve(result) };
  });
  const { result } = renderHook(() =>
    useModelInjection({
      dispatch,
      editor: undefined,
      modelingServiceRef: { current: null } as any,
      currentModelRef: { current: { version: '4.0.0', type: currentType, nodes: [], edges: [] } } as any,
      currentProjectRef: { current: currentProject } as any,
      currentDiagramTypeRef: { current: currentType } as any,
      switchDiagramRef: { current: vi.fn().mockResolvedValue(true) } as any,
      setMessages: vi.fn(),
      setMessageMeta: vi.fn(),
      setProgressMessage: vi.fn(),
    }),
  );
  const references = () => dispatched.filter((a) => a?.type === 'updateDiagramReferences').map((a) => a.arg);
  return { result, references };
}

describe('useModelInjection — object / GUI diagrams reference the class tab they were built from', () => {
  it('links a new object tab to the ACTIVE class tab, not the first one', async () => {
    const { result, references } = setup(project());
    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        diagramType: 'ObjectDiagram',
        systemSpec: objectSpec,
        createNewTab: true,
        message: '',
      } as any);
    });
    expect(references()).toEqual([
      { diagramType: 'ObjectDiagram', diagramIndex: 1, references: { ClassDiagram: 'class-2' } },
    ]);
  });

  it('re-links the existing object tab a complete system was built into', async () => {
    const { result, references } = setup(project());
    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        diagramType: 'ObjectDiagram',
        systemSpec: objectSpec,
        message: '',
      } as any);
    });
    expect(references()).toEqual([
      { diagramType: 'ObjectDiagram', diagramIndex: 0, references: { ClassDiagram: 'class-2' } },
    ]);
  });

  it('leaves a matching reference alone', async () => {
    const { result, references } = setup(project({ ClassDiagram: 'class-2' }));
    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        diagramType: 'ObjectDiagram',
        systemSpec: objectSpec,
        message: '',
      } as any);
    });
    expect(references()).toEqual([]);
  });

  it('does not touch the reference on an incremental edit', async () => {
    const { result, references } = setup(project());
    await act(async () => {
      await result.current.handleInjection({
        action: 'modify_model',
        diagramType: 'ObjectDiagram',
        modifications: [{ action: 'add_object', target: { objectName: 'h2' }, changes: { className: 'Hotel' } }],
        message: '',
      } as any);
    });
    expect(references()).toEqual([]);
  });
});
