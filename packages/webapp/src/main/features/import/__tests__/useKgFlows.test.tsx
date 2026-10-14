/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runPreflight: vi.fn(),
  runConversion: vi.fn(),
  focus: vi.fn(),
  capture: vi.fn(),
}));

vi.mock('../useKgPreflight', () => ({ useKgPreflight: () => ({ runPreflight: mocks.runPreflight }) }));
vi.mock('../useKgToUmlConversion', () => ({
  useKgToUmlConversion: () => mocks.runConversion,
  getActiveKgDiagram: () => ({
    project: { id: 'p1' },
    diagram: {
      id: 'd1',
      title: 'KG',
      model: {
        type: 'KnowledgeGraphDiagram',
        version: '1.0.0',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ id: 'e' }],
      },
    },
  }),
}));
vi.mock('../../../shared/kg/kgFocus', () => ({ focus: mocks.focus }));
vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => ({ capture: mocks.capture }),
}));

import { useKgFlows } from '../useKgFlows';

const REPORT = (issueCount: number) => ({ kgSignature: 'sig-1', diagramType: 'ClassDiagram', issueCount, issues: [] });
const CONSISTENCY_REPORT = { issues: [], issueCount: 2, severityCounts: {}, kgSignature: 'sig-1', inferenceUsed: 'rdfs' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runConversion.mockResolvedValue(undefined);
});

describe('convertToClassDiagram', () => {
  it('does nothing when the preflight could not run', async () => {
    mocks.runPreflight.mockResolvedValue(null);
    const { result } = renderHook(() => useKgFlows());

    await act(async () => result.current.convertToClassDiagram());

    expect(mocks.runConversion).not.toHaveBeenCalled();
    expect(result.current.refineModalProps.open).toBe(false);
  });

  it('converts straight away when the preflight is clean, passing the consistency gate along', async () => {
    mocks.runPreflight.mockResolvedValue(REPORT(0));
    const { result } = renderHook(() => useKgFlows());

    await act(async () => result.current.convertToClassDiagram());

    expect(mocks.runConversion).toHaveBeenCalledWith({
      kgSignature: 'sig-1',
      onConsistencyIssues: expect.any(Function),
    });
    expect(result.current.refineModalProps.open).toBe(false);
  });

  it('opens Refine in convert mode, without converting, when the preflight found issues', async () => {
    mocks.runPreflight.mockResolvedValue(REPORT(3));
    const { result } = renderHook(() => useKgFlows());

    await act(async () => result.current.convertToClassDiagram());

    expect(mocks.runConversion).not.toHaveBeenCalled();
    expect(result.current.refineModalProps).toMatchObject({ open: true, convertMode: true });
  });

  it('converts when the cleaned graph is confirmed in the Refine dialog', async () => {
    mocks.runPreflight.mockResolvedValue(REPORT(3));
    const { result } = renderHook(() => useKgFlows());
    await act(async () => result.current.convertToClassDiagram());

    act(() => result.current.refineModalProps.onConvert('sig-after-cleaning'));

    expect(mocks.runConversion).toHaveBeenCalledWith({
      kgSignature: 'sig-after-cleaning',
      onConsistencyIssues: expect.any(Function),
    });
  });

  it('reports itself as busy only while it runs', async () => {
    let finish: () => void = () => {};
    mocks.runPreflight.mockReturnValue(new Promise((resolve) => { finish = () => resolve(REPORT(0)); }));
    const { result } = renderHook(() => useKgFlows());

    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.convertToClassDiagram(); });
    expect(result.current.isConverting).toBe(true);

    await act(async () => { finish(); await pending; });
    expect(result.current.isConverting).toBe(false);
  });

  it('is not busy any more when the conversion throws', async () => {
    mocks.runPreflight.mockResolvedValue(REPORT(0));
    mocks.runConversion.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useKgFlows());

    await act(async () => { await result.current.convertToClassDiagram().catch(() => {}); });

    expect(result.current.isConverting).toBe(false);
  });
});

describe('the consistency gate', () => {
  /** The conversion asks the gate through the callback it was given. */
  const askGate = async (result: { current: ReturnType<typeof useKgFlows> }) => {
    mocks.runPreflight.mockResolvedValue(REPORT(0));
    let decision: Promise<'proceed' | 'cancel'> = Promise.resolve('cancel');
    mocks.runConversion.mockImplementation(async ({ onConsistencyIssues }) => {
      decision = onConsistencyIssues(CONSISTENCY_REPORT);
      await decision;
    });
    let flow: Promise<void> = Promise.resolve();
    await act(async () => { flow = result.current.convertToClassDiagram(); });
    return { decision: () => decision, flow };
  };

  it('opens with the report while the conversion waits for the user', async () => {
    const { result } = renderHook(() => useKgFlows());

    await askGate(result);

    expect(result.current.consistencyConfirmModalProps).toMatchObject({ open: true, report: CONSISTENCY_REPORT });
  });

  it('lets the conversion proceed', async () => {
    const { result } = renderHook(() => useKgFlows());
    const { decision } = await askGate(result);

    await act(async () => result.current.consistencyConfirmModalProps.onProceed());

    await expect(decision()).resolves.toBe('proceed');
    expect(result.current.consistencyConfirmModalProps.open).toBe(false);
  });

  it('cancels the conversion', async () => {
    const { result } = renderHook(() => useKgFlows());
    const { decision } = await askGate(result);

    await act(async () => result.current.consistencyConfirmModalProps.onCancel());

    await expect(decision()).resolves.toBe('cancel');
    expect(result.current.consistencyConfirmModalProps.open).toBe(false);
    expect(result.current.refineModalProps.open).toBe(false);
  });

  it('cancels the conversion and sends the user to the Consistency tab of Refine', async () => {
    const { result } = renderHook(() => useKgFlows());
    const { decision } = await askGate(result);

    await act(async () => result.current.consistencyConfirmModalProps.onOpenRefine());

    await expect(decision()).resolves.toBe('cancel');
    expect(result.current.consistencyConfirmModalProps.open).toBe(false);
    expect(result.current.refineModalProps).toMatchObject({ open: true, initialTab: 'consistency' });
  });
});

describe('openRefine', () => {
  it('opens Refine on its first tab, not in convert mode', () => {
    const { result } = renderHook(() => useKgFlows());

    act(() => result.current.openRefine());

    expect(result.current.refineModalProps).toMatchObject({ open: true, convertMode: false, initialTab: undefined });
  });

  it('closing Refine resets the mode and the tab', async () => {
    mocks.runPreflight.mockResolvedValue(REPORT(0));
    const { result } = renderHook(() => useKgFlows());
    mocks.runConversion.mockImplementation(({ onConsistencyIssues }) => { void onConsistencyIssues(CONSISTENCY_REPORT); return new Promise(() => {}); });
    await act(async () => { void result.current.convertToClassDiagram(); });
    await act(async () => result.current.consistencyConfirmModalProps.onOpenRefine());
    expect(result.current.refineModalProps.initialTab).toBe('consistency');

    act(() => result.current.refineModalProps.onClose());

    expect(result.current.refineModalProps).toMatchObject({ open: false, convertMode: false, initialTab: undefined });
  });
});

describe('Fix in KG', () => {
  it('brings the affected nodes and their neighbours onto the canvas', () => {
    const { result } = renderHook(() => useKgFlows());

    act(() => result.current.refineModalProps.onFixInKg({ affectedNodeIds: ['a', 'b'] } as any));

    expect(mocks.focus).toHaveBeenCalledWith(['a', 'b'], { maxNeighbors: 15 });
  });

  it('does nothing for an issue that names no node', () => {
    const { result } = renderHook(() => useKgFlows());

    act(() => result.current.refineModalProps.onFixInKg({ affectedNodeIds: [] } as any));
    act(() => result.current.refineModalProps.onFocusNodes([]));

    expect(mocks.focus).not.toHaveBeenCalled();
  });

  it('focuses an explicit node list too', () => {
    const { result } = renderHook(() => useKgFlows());

    act(() => result.current.refineModalProps.onFocusNodes(['x']));

    expect(mocks.focus).toHaveBeenCalledWith(['x'], { maxNeighbors: 15 });
  });
});

describe('analytics', () => {
  it('records which flow was used, with the size of the graph', async () => {
    mocks.runPreflight.mockResolvedValue(REPORT(0));
    const { result } = renderHook(() => useKgFlows());

    await act(async () => result.current.convertToClassDiagram());
    act(() => result.current.openRefine());

    expect(mocks.capture).toHaveBeenCalledWith('generator_used', {
      generator_type: 'kg_to_class',
      diagram_type: 'KnowledgeGraphDiagram',
      nodes_count: 2,
      edges_count: 1,
    });
    expect(mocks.capture).toHaveBeenCalledWith('generator_used', expect.objectContaining({ generator_type: 'kg_refine' }));
  });
});
