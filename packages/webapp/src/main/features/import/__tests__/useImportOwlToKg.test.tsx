/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ importOwl: vi.fn() }));
const dispatch = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warn: vi.fn() }));
const storage = vi.hoisted(() => ({ getCurrentProject: vi.fn(), updateDiagram: vi.fn() }));

vi.mock('../../../shared/api/knowledgeGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/knowledgeGraph')>()),
  ...api,
}));
vi.mock('react-toastify', () => ({ toast }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../../app/store/workspaceSlice', () => ({
  addDiagramThunk: () => ({ type: 'add' }),
  bumpEditorRevision: () => ({ type: 'bump' }),
  switchDiagramIndexThunk: () => ({ type: 'switch' }),
}));
vi.mock('../../../app/store/errorManagementSlice', () => ({
  displayError: (title: string, message: string) => ({ type: 'error', title, message }),
}));
vi.mock('../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: storage,
}));

import { useImportOwlToKg } from '../useImportOwlToKg';

const EMPTY_KG = { type: 'KnowledgeGraphDiagram', version: '1.0.0', nodes: [], edges: [] };
const project = {
  id: 'p1',
  currentDiagramType: 'KnowledgeGraphDiagram',
  currentDiagramIndices: { KnowledgeGraphDiagram: 0 },
  diagrams: { KnowledgeGraphDiagram: [{ id: 'd1', title: 'KG', model: EMPTY_KG }] },
};
const imported = (warnings?: unknown) => ({
  title: 'people',
  model: { ...EMPTY_KG, nodes: [{ id: 'n1', nodeType: 'class', label: 'Person' }] },
  diagramType: 'KnowledgeGraphDiagram',
  ...(warnings === undefined ? {} : { warnings }),
});

beforeEach(() => {
  for (const fn of [...Object.values(api), dispatch, ...Object.values(toast), ...Object.values(storage)]) fn.mockReset();
  storage.getCurrentProject.mockReturnValue(project);
  storage.updateDiagram.mockReturnValue(true);
});

describe('useImportOwlToKg: what the importer skipped', () => {
  it('shows the backend warnings and still imports the graph', async () => {
    api.importOwl.mockResolvedValue(
      imported([{ code: 'SHACL_QUALIFIED_COUNT_INVALID', message: "Ignored sh:qualifiedMinCount 'many'." }]),
    );
    const { result } = renderHook(() => useImportOwlToKg());

    await act(async () => {
      await result.current.runImport(new File(['x'], 'people.ttl'));
    });

    expect(toast.warn).toHaveBeenCalledWith("Ignored sh:qualifiedMinCount 'many'.", {
      toastId: 'kg-import-SHACL_QUALIFIED_COUNT_INVALID',
    });
    expect(storage.updateDiagram).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it.each([[[]], [undefined]])('shows no warning when there is none (%j)', async (warnings) => {
    api.importOwl.mockResolvedValue(imported(warnings));
    const { result } = renderHook(() => useImportOwlToKg());

    await act(async () => {
      await result.current.runImport(new File(['x'], 'people.ttl'));
    });

    expect(toast.warn).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
