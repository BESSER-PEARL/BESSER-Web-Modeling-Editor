/* @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useKgPreflight } from '../useKgPreflight';

// Mock the KG diagram lookup helper.
vi.mock('../useKgToUmlConversion', async () => {
  const actual = await vi.importActual<typeof import('../useKgToUmlConversion')>(
    '../useKgToUmlConversion',
  );
  return {
    ...actual,
    getActiveKgDiagram: vi.fn(() => ({
      project: { id: 'p1', name: 'Test' },
      diagram: { id: 'd1', title: 'KG', model: { type: 'KnowledgeGraphDiagram', nodes: [], edges: [] } },
    })),
  };
});

vi.mock('../../../shared/constants/constant', () => ({
  BACKEND_URL: 'http://localhost:9000/besser_api',
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}));

describe('useKgPreflight', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts to /analyze-kg-for-buml-conversion with the diagram and parses the report', async () => {
    const fakeReport = {
      kgSignature: 'sig-xyz',
      diagramType: 'ClassDiagram',
      issueCount: 1,
      issues: [
        {
          id: 'i1',
          code: 'PROPERTY_NO_DOMAIN',
          description: 'no domain',
          affectedNodeIds: [],
          affectedEdgeIds: [],
          recommendedAction: { key: 'attach_to_thing', parameters: {}, label: 'Attach to Thing' },
          skipAction: { key: 'drop_property', parameters: {}, label: 'Drop' },
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => fakeReport,
    } as unknown as Response);

    const { result } = renderHook(() => useKgPreflight());

    let report: unknown;
    await act(async () => {
      report = await result.current.runPreflight('kg_to_class');
    });
    expect(report).toEqual(fakeReport);
    expect(result.current.report).toEqual(fakeReport);
    expect(result.current.status).toBe('success');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/analyze-kg-for-buml-conversion');
    expect(String(url)).toContain('diagramType=ClassDiagram');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.id).toBe('d1');
  });

  it('uses ObjectDiagram diagramType for kg_to_object target', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ kgSignature: 's', diagramType: 'ObjectDiagram', issueCount: 0, issues: [] }),
    } as unknown as Response);
    const { result } = renderHook(() => useKgPreflight());
    await act(async () => {
      await result.current.runPreflight('kg_to_object');
    });
    expect(String(fetchSpy.mock.calls[0][0])).toContain('diagramType=ObjectDiagram');
  });

  it('sets status="error" and returns null on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'boom' }),
    } as unknown as Response);

    const { result } = renderHook(() => useKgPreflight());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.runPreflight('kg_to_class');
    });
    expect(returned).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.report).toBeNull();
  });
});
