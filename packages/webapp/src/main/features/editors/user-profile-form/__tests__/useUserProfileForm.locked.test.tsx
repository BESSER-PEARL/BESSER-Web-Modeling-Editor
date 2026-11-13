import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { BesserEditor, UMLModel } from '@besser/wme';
import type { MetaTree } from '../metamodel-tree';
import type { Instance } from '../types';

const user = {
  className: 'User',
  classId: 'c-user',
  attributes: [{ id: 'a-age', name: 'age', type: 'int' }],
  children: [],
};
const tree: MetaTree = { root: user, byClassName: { User: user } };

vi.mock('../metamodel-tree', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../metamodel-tree')>()),
  buildMetamodelTree: () => tree,
}));
vi.mock('../../../../app/store/hooks', () => ({
  useAppDispatch: () => () => ({ unwrap: () => Promise.resolve() }),
}));

import { useUserProfileForm } from '../useUserProfileForm';

/** The profile form is a second editing surface: a lock on the canvas holds it too. */

const userModel = (over: Partial<UMLModel> = {}): UMLModel =>
  ({
    version: '4.0.0',
    id: 'u',
    title: 'Users',
    type: 'UserDiagram',
    nodes: [],
    edges: [],
    assessments: {},
    ...over,
  }) as unknown as UMLModel;

const fakeEditor = (model: UMLModel) => {
  const listeners: ((m: UMLModel) => void)[] = [];
  const editor = {
    model,
    ready: Promise.resolve(),
    applyModel: vi.fn(),
    subscribeToModelChange: (cb: (m: UMLModel) => void) => listeners.push(cb),
    unsubscribeFromModelChange: vi.fn(),
  };
  const emit = (next: UMLModel) => {
    editor.model = next;
    listeners.forEach((cb) => cb(next));
  };
  return { editor, emit };
};

const setAge = (prev: Instance): Instance => ({
  ...prev,
  attributes: prev.attributes.map((a) => ({ ...a, value: '30' })),
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useUserProfileForm while locked', () => {
  it('ignores edits on a locked diagram and accepts them once unlocked', async () => {
    const { editor, emit } = fakeEditor(userModel({ locked: true }));
    const { result } = renderHook(() => useUserProfileForm(true, editor as unknown as BesserEditor));
    expect(result.current.locked).toBe(true);

    act(() => result.current.applyEdit(setAge));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(editor.applyModel).not.toHaveBeenCalled();
    expect(result.current.formState?.attributes[0].value).toBe('');

    act(() => emit(userModel()));
    expect(result.current.locked).toBe(false);
    act(() => result.current.applyEdit(setAge));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(editor.applyModel).toHaveBeenCalledTimes(1);
  });

  it('treats a locked box as a lock on the form', () => {
    const lockedBox = {
      id: 'n1',
      type: 'UserModelName',
      position: { x: 0, y: 0 },
      width: 200,
      height: 60,
      data: { name: 'user_1', attributes: [], methods: [] },
      locked: true,
    };
    const { editor } = fakeEditor(userModel({ nodes: [lockedBox] as unknown as UMLModel['nodes'] }));
    const { result } = renderHook(() => useUserProfileForm(true, editor as unknown as BesserEditor));
    expect(result.current.locked).toBe(true);
  });
});
