/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  analyzeKg: vi.fn(),
  applyKgRefinement: vi.fn(),
  llmCleanKg: vi.fn(),
  classifyOrphansWithLlm: vi.fn(),
}));
const dispatch = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warn: vi.fn() }));

vi.mock('../../../shared/api/knowledgeGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/knowledgeGraph')>()),
  ...api,
}));
vi.mock('react-toastify', () => ({ toast }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../../app/store/workspaceSlice', () => ({
  bumpEditorRevision: () => ({ type: 'bump' }),
  updateDiagramModelThunk: (arg: unknown) => ({ type: 'update', arg }),
}));
vi.mock('../../../app/store/errorManagementSlice', () => ({
  displayError: (title: string, message: string) => ({ type: 'error', title, message }),
}));
vi.mock('../useKgToUmlConversion', () => ({
  getActiveKgDiagram: () => ({
    project: { id: 'p1' },
    diagram: { id: 'd1', title: 'KG', model: { type: 'KnowledgeGraphDiagram', nodes: [], edges: [] } },
  }),
}));

import { ApiError } from '../../../shared/api/api-client';
import { useKgRefine } from '../useKgRefine';

const REPORT = { kgSignature: 'sig', diagramType: 'ClassDiagram', issueCount: 0, issues: [] };

beforeEach(() => {
  for (const fn of [...Object.values(api), dispatch, ...Object.values(toast)]) fn.mockReset();
  // `dispatch(thunk).unwrap()` is how the hook awaits store updates.
  dispatch.mockReturnValue({ unwrap: async () => ({}) });
});

describe('runLlmFullCleanup', () => {
  it('asks for a description and a key before calling the backend', async () => {
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.runLlmFullCleanup('   ', 'sk-key')).toBeNull();
      expect(await result.current.runLlmFullCleanup('a library', '  ')).toBeNull();
    });

    expect(api.llmCleanKg).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it('sends the trimmed description and key together with the active diagram', async () => {
    api.llmCleanKg.mockResolvedValue(REPORT);
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      await result.current.runLlmFullCleanup('  a library  ', '  sk-key  ');
    });

    expect(api.llmCleanKg).toHaveBeenCalledWith({
      diagram: expect.objectContaining({ id: 'd1' }),
      description: 'a library',
      apiKey: 'sk-key',
    });
    expect(result.current.llmStatus).toBe('success');
    expect(result.current.llmReport).toEqual(REPORT);
  });

  it("shows the backend's own message when the upstream call fails", async () => {
    api.llmCleanKg.mockRejectedValue(new ApiError(502, 'The language-model service failed. Please try again later.'));
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.runLlmFullCleanup('a library', 'sk-key')).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith('The language-model service failed. Please try again later.');
    expect(result.current.llmStatus).toBe('error');
    expect(result.current.llmReport).toBeNull();
  });

  it('explains a timeout instead of showing milliseconds', async () => {
    api.llmCleanKg.mockRejectedValue(new DOMException('Request timed out after 130000ms', 'TimeoutError'));
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      await result.current.runLlmFullCleanup('a library', 'sk-key');
    });

    const shown = toast.error.mock.calls[0][0] as string;
    expect(shown).not.toMatch(/130000/);
    expect(shown.toLowerCase()).toContain('too long');
  });

  it('rejects a reply that is not a report', async () => {
    api.llmCleanKg.mockResolvedValue({ unexpected: true });
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.runLlmFullCleanup('a library', 'sk-key')).toBeNull();
    });

    expect(result.current.llmStatus).toBe('error');
  });
});

describe('runLlmOrphanClassification', () => {
  it('needs at least one node', async () => {
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.runLlmOrphanClassification('a library', 'sk-key', [], 'sig')).toBeNull();
    });

    expect(api.classifyOrphansWithLlm).not.toHaveBeenCalled();
  });

  it('passes the nodes and the signature along', async () => {
    api.classifyOrphansWithLlm.mockResolvedValue(REPORT);
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      await result.current.runLlmOrphanClassification('a library', 'sk-key', ['n1', 'n2'], 'sig');
    });

    expect(api.classifyOrphansWithLlm).toHaveBeenCalledWith({
      diagram: expect.objectContaining({ id: 'd1' }),
      description: 'a library',
      apiKey: 'sk-key',
      nodeIds: ['n1', 'n2'],
      kgSignature: 'sig',
    });
  });
});

describe('static analysis and applying', () => {
  it('runStatic returns the report', async () => {
    api.analyzeKg.mockResolvedValue(REPORT);
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.runStatic()).toEqual(REPORT);
    });

    expect(result.current.staticStatus).toBe('success');
  });

  it('applyStatic stores the cleaned graph and reports the pending orphans', async () => {
    const cleaned = { type: 'KnowledgeGraphDiagram', version: '1.0.0', nodes: [], edges: [] };
    api.applyKgRefinement.mockResolvedValue({
      model: cleaned,
      kgSignature: 'new-sig',
      pendingOrphanClassification: { nodeIds: ['o1'], kgSignature: 'new-sig' },
    });
    const { result } = renderHook(() => useKgRefine());

    let applied: unknown;
    await act(async () => {
      applied = await result.current.applyStatic([{ issueId: 'i1', decision: 'accept' }], 'sig');
    });

    expect(api.applyKgRefinement).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'static', kgSignature: 'sig', resolutions: [{ issueId: 'i1', decision: 'accept' }] }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: 'update', arg: { model: cleaned } });
    expect(applied).toEqual({
      pendingOrphanClassification: { nodeIds: ['o1'], kgSignature: 'new-sig' },
      newKgSignature: 'new-sig',
    });
  });

  it('applyLlm sends the LLM issues back', async () => {
    api.applyKgRefinement.mockResolvedValue({ model: { nodes: [], edges: [] }, kgSignature: 's2' });
    const issue = { id: 'i1', code: 'X', description: '', affectedNodeIds: [], affectedEdgeIds: [], recommendedAction: null, skipAction: null };
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.applyLlm([{ issueId: 'i1', decision: 'skip' }], [issue], 'sig')).toBe(true);
    });

    expect(api.applyKgRefinement).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'llm', llmIssues: [issue], resolutions: [{ issueId: 'i1', decision: 'skip' }] }),
    );
  });

  it('applyStatic reports a stale-graph rejection and keeps the model as it was', async () => {
    api.applyKgRefinement.mockRejectedValue(new ApiError(409, 'The graph changed since the analysis.'));
    const { result } = renderHook(() => useKgRefine());

    await act(async () => {
      expect(await result.current.applyStatic([], 'old')).toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith('The graph changed since the analysis.');
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
  });
});
