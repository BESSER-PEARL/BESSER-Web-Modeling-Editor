/* @vitest-environment jsdom */
/**
 * Closing the Refine dialog while the AI classifies orphan nodes, with the real
 * refine hook: the batches stop, and the dialog opens again clean.
 */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  analyzeKg: vi.fn(),
  applyKgRefinement: vi.fn(),
  llmCleanKg: vi.fn(),
  classifyOrphansWithLlm: vi.fn(),
  getKgConfig: vi.fn(),
}));
vi.mock('../../../../shared/api/knowledgeGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/api/knowledgeGraph')>()),
  ...api,
}));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() } }));
// Stable, like the store's: an unstable dispatch re-creates the hook's callbacks
// on every render, which the dialog's reset-on-close effect depends on.
const dispatch = vi.hoisted(() => () => ({ unwrap: async () => ({}) }));
vi.mock('../../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../activeKgDiagram', () => ({
  getActiveKgDiagram: () => ({
    project: { id: 'p1' },
    diagram: { id: 'd1', title: 'KG', model: { type: 'KnowledgeGraphDiagram', nodes: [], edges: [] } },
  }),
}));
// The key dialog asks the server for the free-tier advertisement.
vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)) };
});

import { KgRefineModal } from '../KgRefineModal';

const ORPHAN_ISSUE = {
  id: 'o1',
  code: 'ORPHAN_NODE_NO_CLASS_LINK',
  description: '3 orphan nodes',
  affectedNodeIds: ['n1', 'n2', 'n3'],
  affectedEdgeIds: [],
  recommendedAction: { key: 'drop_node', parameters: {}, label: 'Drop 3 orphan nodes' },
  skipAction: { key: 'defer_orphan_to_llm', parameters: {}, label: 'Send 3 nodes to the LLM' },
};
const report = (issues: unknown[]) => ({ kgSignature: 'sig', diagramType: 'ClassDiagram', issueCount: issues.length, issues });

/** The dialog as the app hosts it: closing it sets `open` to false. */
let setOpen: (open: boolean) => void = () => {};
const Host: React.FC = () => {
  const [open, setOpenState] = useState(true);
  setOpen = setOpenState;
  return <KgRefineModal open={open} onClose={() => setOpenState(false)} />;
};

/** Orphan batches held open until the test answers them; an aborted one
 *  rejects with its signal's reason, as `fetch` does. */
const batches: Array<(report: unknown) => void> = [];

beforeEach(() => {
  vi.clearAllMocks();
  batches.length = 0;
  window.sessionStorage.clear();
  window.sessionStorage.setItem('besser_llm_api_key', 'sk-openai-key');
  window.sessionStorage.setItem('besser_llm_provider', 'openai');
  api.analyzeKg.mockResolvedValue(report([ORPHAN_ISSUE]));
  api.applyKgRefinement.mockResolvedValue({
    model: { type: 'KnowledgeGraphDiagram', version: '1.0.0', nodes: [], edges: [] },
    kgSignature: 'sig-after',
    pendingOrphanClassification: { nodeIds: ['n1', 'n2', 'n3'], kgSignature: 'sig-after' },
  });
  api.getKgConfig.mockResolvedValue({ llmRequestTimeoutSeconds: 200, maxOrphanClassifyNodes: 1 });
  api.classifyOrphansWithLlm.mockImplementation(
    ({ signal }: { signal: AbortSignal }) =>
      new Promise((resolve, reject) => {
        batches.push(resolve);
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  );
});

/** Static tab: send the orphans to the AI, which opens the AI tab on them. */
async function startOrphanClassification() {
  await waitFor(() => expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('kg-issue-routing-llm-o1'));
  fireEvent.click(screen.getByTestId('kg-refine-static-apply'));
  await waitFor(() => expect(screen.getByTestId('kg-refine-pending-orphan-banner')).toBeInTheDocument());
  fireEvent.click(screen.getByTestId('kg-refine-llm-analyze'));
  await waitFor(() => expect(batches).toHaveLength(1));
}

describe('KgRefineModal: closing while the AI classifies orphans', () => {
  it('can be cancelled while the analysis runs', async () => {
    render(<Host />);
    await startOrphanClassification();

    expect(screen.getByTestId('kg-refine-llm-cancel')).toBeEnabled();
    fireEvent.click(screen.getByTestId('kg-refine-llm-cancel'));

    await waitFor(() => expect(screen.queryByTestId('kg-refine-panel-llm')).toBeNull());
    expect(api.classifyOrphansWithLlm.mock.calls[0][0].signal.aborted).toBe(true);
  });

  it('sends no further batch after the dialog closed, and opens again without a stale review', async () => {
    render(<Host />);
    await startOrphanClassification();
    await act(async () => batches[0](report([])));
    await waitFor(() => expect(batches).toHaveLength(2));

    fireEvent.click(screen.getByTestId('kg-refine-llm-cancel'));
    // The batch that was running answers anyway; the third is never sent.
    await act(async () => batches[1](report([{ ...ORPHAN_ISSUE, id: 'late' }])));

    expect(api.classifyOrphansWithLlm).toHaveBeenCalledTimes(2);

    act(() => setOpen(true));
    await waitFor(() => expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('kg-refine-tab-llm'));

    expect(screen.getByTestId('kg-refine-description')).toBeInTheDocument();
    expect(screen.queryByTestId('kg-refine-pending-orphan-banner')).toBeNull();
    expect(screen.queryByTestId('kg-refine-llm-issue-list')).toBeNull();
    expect(screen.getByTestId('kg-refine-llm-analyze')).toHaveTextContent('Analyze');
  });
});
