/* @vitest-environment jsdom */
/**
 * A KG -> class diagram conversion is reported once it really happened
 * (`generator_used`) or failed (`generator_failed`, with the error's kind but
 * never its message), not when its preflight finished.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ kgToClassDiagram: vi.fn(), checkKgConsistency: vi.fn() }));
const dispatch = vi.hoisted(() => vi.fn());
const captureEvent = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/api/knowledgeGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/knowledgeGraph')>()),
  ...api,
}));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() } }));
vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));
vi.mock('../../../shared/kg/reportKgWarnings', () => ({ reportKgWarnings: vi.fn() }));
vi.mock('../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { updateDiagram: vi.fn() },
}));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../../app/store/workspaceSlice', () => ({
  addDiagramThunk: () => ({ type: 'add' }),
  switchDiagramIndexThunk: () => ({ type: 'index' }),
  switchDiagramTypeThunk: () => ({ type: 'type' }),
}));
vi.mock('../../../app/store/errorManagementSlice', () => ({
  displayError: (title: string, message: string) => ({ type: 'error', title, message }),
}));
vi.mock('../activeKgDiagram', () => ({
  getActiveKgDiagram: () => ({
    project: { id: 'p1', name: 'Acme Hospital' },
    diagram: {
      id: 'd1',
      title: 'Acme KG',
      model: { type: 'KnowledgeGraphDiagram', nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ id: 'e' }] },
    },
  }),
}));

import { ApiError } from '../../../shared/api/api-client';
import { useKgToUmlConversion } from '../convert/useKgToUmlConversion';

const events = () => captureEvent.mock.calls.filter(([event]) => event.startsWith('generator_'));

beforeEach(() => {
  for (const fn of [...Object.values(api), dispatch, captureEvent]) fn.mockReset();
  dispatch.mockReturnValue({ unwrap: async () => ({ diagram: { id: 'c1' }, index: 0 }) });
});

describe('KG conversion analytics', () => {
  it('reports a conversion that produced a class diagram, with the size of the graph', async () => {
    api.kgToClassDiagram.mockResolvedValue({ model: { elements: {} }, diagramType: 'ClassDiagram', warnings: [] });
    const { result } = renderHook(() => useKgToUmlConversion());

    await act(async () => result.current());

    expect(events()).toEqual([
      [
        'generator_used',
        {
          generator_type: 'kg_to_class',
          diagram_type: 'KnowledgeGraphDiagram',
          duration_ms: expect.any(Number),
          nodes_count: 2,
          edges_count: 1,
        },
      ],
    ]);
  });

  it('reports a failed conversion with its HTTP status, never the message', async () => {
    api.kgToClassDiagram.mockRejectedValue(new ApiError(422, 'Class "Acme Patient" is invalid', 'Acme Patient'));
    const { result } = renderHook(() => useKgToUmlConversion());

    await act(async () => result.current());

    expect(events()).toEqual([
      [
        'generator_failed',
        {
          generator_type: 'kg_to_class',
          diagram_type: 'KnowledgeGraphDiagram',
          reason: 'request',
          duration_ms: expect.any(Number),
          error_type: 'ApiError',
          http_status: 422,
          network_error: false,
        },
      ],
    ]);
    expect(JSON.stringify(captureEvent.mock.calls)).not.toMatch(/acme/i);
  });
});
