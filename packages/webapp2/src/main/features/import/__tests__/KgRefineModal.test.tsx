/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the component under test.
vi.mock('../useKgRefine', () => {
  const mock = {
    staticStatus: 'success',
    staticReport: {
      kgSignature: 'sig-static',
      diagramType: 'ClassDiagram',
      issueCount: 2,
      issues: [
        {
          id: 's1',
          code: 'PROPERTY_NO_DOMAIN',
          description: 'No domain',
          affectedNodeIds: ['p1'],
          affectedEdgeIds: [],
          recommendedAction: { key: 'attach_to_thing', parameters: {}, label: 'Attach' },
          skipAction: { key: 'drop_property', parameters: {}, label: 'Drop' },
        },
        {
          id: 's2',
          code: 'PROPERTY_NO_RANGE',
          description: 'No range',
          affectedNodeIds: ['p2'],
          affectedEdgeIds: [],
          recommendedAction: { key: 'set_range', parameters: {}, label: 'Set range' },
          skipAction: { key: 'drop_property', parameters: {}, label: 'Drop' },
        },
      ],
    },
    runStatic: vi.fn().mockResolvedValue(null),
    applyStatic: vi.fn().mockResolvedValue({
      pendingOrphanClassification: null,
      newKgSignature: 'sig-new',
    }),
    llmStatus: 'idle',
    llmReport: null,
    runLlmFullCleanup: vi.fn(),
    runLlmOrphanClassification: vi.fn(),
    applyLlm: vi.fn().mockResolvedValue(true),
    reset: vi.fn(),
  };
  return {
    useKgRefine: () => mock,
    __mock: mock,
  };
});

vi.mock('../../../shared/hooks/useOpenAIApiKey', () => ({
  useOpenAIApiKey: () => ({ apiKey: '', setApiKey: vi.fn(), clearApiKey: vi.fn() }),
}));

import { KgRefineModal } from '../KgRefineModal';

describe('KgRefineModal — partial-apply UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all rows with header Fix-in-KG buttons (alwaysShowFixInKg)', async () => {
    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    // Both rows show the always-visible header Fix-in-KG button.
    const headerButtons = screen.getAllByTestId('kg-issue-fix-in-kg-header');
    expect(headerButtons).toHaveLength(2);
  });

  it('Fix-in-KG button (header) calls onFixInKg and closes the modal', async () => {
    const onClose = vi.fn();
    const onFixInKg = vi.fn();
    render(<KgRefineModal open onClose={onClose} onFixInKg={onFixInKg} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    const buttons = screen.getAllByTestId('kg-issue-fix-in-kg-header');
    fireEvent.click(buttons[0]);
    expect(onFixInKg).toHaveBeenCalledTimes(1);
    expect(onFixInKg.mock.calls[0][0].id).toBe('s1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Apply button shows recommended count and updates as user toggles', async () => {
    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    const apply = screen.getByTestId('kg-refine-static-apply');
    // Default: all selected, all routed to recommended.
    expect(apply).toHaveTextContent('Apply 2 recommended');

    // Uncheck one row → count drops to 1.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(apply).toHaveTextContent('Apply 1 recommended');

    // Uncheck the other → 0, button disabled.
    fireEvent.click(checkboxes[1]);
    expect(apply).toBeDisabled();
  });

  it('Deselect all sets all rows to skip; Select all flips them back', async () => {
    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    const apply = screen.getByTestId('kg-refine-static-apply');

    fireEvent.click(screen.getByTestId('kg-refine-static-deselect-all'));
    expect(apply).toBeDisabled();
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).not.toBeChecked());

    fireEvent.click(screen.getByTestId('kg-refine-static-select-all'));
    expect(apply).toHaveTextContent('Apply 2 recommended');
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeChecked());
  });

  it('summary line splits the selection into recommended + LLM counts', async () => {
    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    const summary = screen.getByTestId('kg-refine-static-summary');
    // Default: 2 selected, both recommended.
    expect(
      screen.getByTestId('kg-refine-static-summary-recommended'),
    ).toHaveTextContent('2 via recommended');
    expect(screen.getByTestId('kg-refine-static-summary-llm')).toHaveTextContent('0 via LLM');

    // Flip the first row to LLM.
    fireEvent.click(screen.getByTestId('kg-issue-routing-llm-s1'));
    expect(
      screen.getByTestId('kg-refine-static-summary-recommended'),
    ).toHaveTextContent('1 via recommended');
    expect(screen.getByTestId('kg-refine-static-summary-llm')).toHaveTextContent('1 via LLM');

    // Apply button label reflects the mix.
    expect(screen.getByTestId('kg-refine-static-apply')).toHaveTextContent(
      'Apply 2 (1 rec + 1 LLM)',
    );

    // Deselecting an LLM-routed row must reduce the LLM count, not the
    // recommended count — confirms select-all toggles only inclusion.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(
      screen.getByTestId('kg-refine-static-summary-llm'),
    ).toHaveTextContent('0 via LLM');
    expect(summary).toHaveTextContent('1 of 2 will be fixed');
  });

  it('Select all / Deselect all do NOT flip the routing radio (per-row routing is preserved)', async () => {
    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    // Initial: both rows routed to "Recommended".
    expect(screen.getByTestId('kg-issue-routing-recommended-s1')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('kg-issue-routing-recommended-s2')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Flip s2 to LLM.
    fireEvent.click(screen.getByTestId('kg-issue-routing-llm-s2'));
    expect(screen.getByTestId('kg-issue-routing-llm-s2')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Deselect all → all checkboxes unchecked, routing toggles disappear
    // (because they only render when the row is selected).
    fireEvent.click(screen.getByTestId('kg-refine-static-deselect-all'));
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).not.toBeChecked());
    expect(screen.queryByTestId('kg-issue-routing-recommended-s1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kg-issue-routing-llm-s2')).not.toBeInTheDocument();

    // Select all → checkboxes back on, routing toggles reappear with their
    // *previous* routing intact: s1=recommended, s2=llm. Select-all must
    // NOT flip routing.
    fireEvent.click(screen.getByTestId('kg-refine-static-select-all'));
    expect(screen.getByTestId('kg-issue-routing-recommended-s1')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('kg-issue-routing-llm-s1')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByTestId('kg-issue-routing-recommended-s2')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByTestId('kg-issue-routing-llm-s2')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('Unchecked rows are OMITTED from the wire payload (issue is left untouched)', async () => {
    const mod = await import('../useKgRefine');
    const mock = (mod as unknown as { __mock: { applyStatic: ReturnType<typeof vi.fn> } }).__mock;

    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    // Uncheck s2 → user wants to leave the issue alone.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByTestId('kg-refine-static-apply'));

    await waitFor(() => {
      expect(mock.applyStatic).toHaveBeenCalledTimes(1);
    });
    const [decisions] = mock.applyStatic.mock.calls[0];
    expect(decisions).toEqual([{ issueId: 's1', decision: 'accept' }]);
  });

  it('Non-orphan LLM-routed rows are OMITTED (skip_action would be destructive)', async () => {
    const mod = await import('../useKgRefine');
    const mock = (mod as unknown as { __mock: { applyStatic: ReturnType<typeof vi.fn> } }).__mock;
    render(<KgRefineModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    // Route s2 (PROPERTY_NO_RANGE — non-orphan) to LLM.
    fireEvent.click(screen.getByTestId('kg-issue-routing-llm-s2'));
    fireEvent.click(screen.getByTestId('kg-refine-static-apply'));

    await waitFor(() => {
      expect(mock.applyStatic).toHaveBeenCalledTimes(1);
    });
    const [decisions] = mock.applyStatic.mock.calls[0];
    // s1 → accept (recommended). s2 → omitted: sending 'skip' would
    // invoke skipAction.key='drop_property', deleting the property; we
    // want it preserved so the LLM can address it on the AI tab.
    expect(decisions).toEqual([{ issueId: 's1', decision: 'accept' }]);

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-deferred-banner')).toBeInTheDocument();
    });
  });

  it('convert mode: shows Convert button when analyzer reports zero issues', async () => {
    vi.doMock('../useKgRefine', () => {
      const m = {
        staticStatus: 'success',
        staticReport: {
          kgSignature: 'sig-clean',
          diagramType: 'ClassDiagram',
          issueCount: 0,
          issues: [],
        },
        runStatic: vi.fn().mockResolvedValue(null),
        applyStatic: vi.fn(),
        llmStatus: 'idle',
        llmReport: null,
        runLlmFullCleanup: vi.fn(),
        runLlmOrphanClassification: vi.fn(),
        applyLlm: vi.fn(),
        reset: vi.fn(),
      };
      return { useKgRefine: () => m, __mock: m };
    });
    vi.resetModules();
    const { KgRefineModal: FreshModal } = await import('../KgRefineModal');

    const onConvert = vi.fn();
    const onClose = vi.fn();
    render(
      <FreshModal
        open
        onClose={onClose}
        onFixInKg={vi.fn()}
        convertTarget="kg_to_class"
        onConvert={onConvert}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-convert-ready')).toBeInTheDocument();
    });
    const convert = screen.getByTestId('kg-refine-convert');
    expect(convert).toHaveTextContent('Convert to Class Diagram');

    fireEvent.click(convert);
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledWith('sig-clean');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('convert mode: while issues remain, Apply is shown and Convert is hidden', async () => {
    render(
      <KgRefineModal
        open
        onClose={vi.fn()}
        onFixInKg={vi.fn()}
        convertTarget="kg_to_class"
        onConvert={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('kg-refine-convert')).not.toBeInTheDocument();
    expect(screen.getByTestId('kg-refine-static-apply')).toBeInTheDocument();
  });

  it('convert mode: applyStatic is invoked with the convert target diagram', async () => {
    vi.doMock('../useKgRefine', () => {
      const m = {
        staticStatus: 'success',
        staticReport: {
          kgSignature: 'sig-obj',
          diagramType: 'ObjectDiagram',
          issueCount: 1,
          issues: [
            {
              id: 'i1',
              code: 'PROPERTY_NO_DOMAIN',
              description: 'No domain',
              affectedNodeIds: ['p1'],
              affectedEdgeIds: [],
              recommendedAction: { key: 'attach_to_thing', parameters: {}, label: 'Attach' },
              skipAction: { key: 'drop_property', parameters: {}, label: 'Drop' },
            },
          ],
        },
        runStatic: vi.fn().mockResolvedValue({
          kgSignature: 'sig-obj-after',
          diagramType: 'ObjectDiagram',
          issueCount: 0,
          issues: [],
        }),
        applyStatic: vi.fn().mockResolvedValue({
          pendingOrphanClassification: null,
          newKgSignature: 'sig-obj-after',
        }),
        llmStatus: 'idle',
        llmReport: null,
        runLlmFullCleanup: vi.fn(),
        runLlmOrphanClassification: vi.fn(),
        applyLlm: vi.fn(),
        reset: vi.fn(),
      };
      return { useKgRefine: () => m, __mock: m };
    });
    vi.resetModules();
    const { KgRefineModal: FreshModal } = await import('../KgRefineModal');
    const { __mock: mock } = (await import('../useKgRefine')) as unknown as {
      __mock: { applyStatic: ReturnType<typeof vi.fn>; runStatic: ReturnType<typeof vi.fn> };
    };

    render(
      <FreshModal
        open
        onClose={vi.fn()}
        onFixInKg={vi.fn()}
        convertTarget="kg_to_object"
        onConvert={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('kg-refine-static-apply'));

    await waitFor(() => {
      expect(mock.applyStatic).toHaveBeenCalledTimes(1);
    });
    // Third positional argument is the diagram type derived from the
    // conversion target (kg_to_object → ObjectDiagram).
    expect(mock.applyStatic.mock.calls[0][2]).toBe('ObjectDiagram');
    // After apply, convert mode re-runs the static analyzer instead of
    // closing.
    await waitFor(() => {
      expect(mock.runStatic).toHaveBeenCalled();
    });
    const runStaticCalls = mock.runStatic.mock.calls;
    expect(runStaticCalls[runStaticCalls.length - 1]?.[0]).toBe('ObjectDiagram');
  });

  it('Orphan LLM-routed rows DO send skip (backend defers via DeferredOrphanClassification)', async () => {
    // Re-mock useKgRefine for this test with an orphan issue in the report.
    const orphanIssue = {
      id: 'o1',
      code: 'ORPHAN_NODE_NO_CLASS_LINK',
      description: '1 orphan node',
      affectedNodeIds: ['lit:abc'],
      affectedEdgeIds: [],
      recommendedAction: { key: 'drop_node', parameters: { node_ids: ['lit:abc'] }, label: 'Drop 1 orphan node' },
      skipAction: { key: 'defer_orphan_to_llm', parameters: {}, label: 'Send 1 node to the LLM for classification' },
    };
    vi.doMock('../useKgRefine', () => {
      const m = {
        staticStatus: 'success',
        staticReport: {
          kgSignature: 'sig-orphan',
          diagramType: 'ClassDiagram',
          issueCount: 1,
          issues: [orphanIssue],
        },
        runStatic: vi.fn().mockResolvedValue(null),
        applyStatic: vi.fn().mockResolvedValue({
          pendingOrphanClassification: { nodeIds: ['lit:abc'], kgSignature: 'sig-after' },
          newKgSignature: 'sig-after',
        }),
        llmStatus: 'idle',
        llmReport: null,
        runLlmFullCleanup: vi.fn(),
        runLlmOrphanClassification: vi.fn(),
        applyLlm: vi.fn().mockResolvedValue(true),
        reset: vi.fn(),
      };
      return { useKgRefine: () => m, __mock: m };
    });
    vi.resetModules();
    const { KgRefineModal: FreshModal } = await import('../KgRefineModal');
    const { __mock: mock } = (await import('../useKgRefine')) as unknown as {
      __mock: { applyStatic: ReturnType<typeof vi.fn> };
    };

    render(<FreshModal open onClose={vi.fn()} onFixInKg={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('kg-refine-static-issue-list')).toBeInTheDocument();
    });

    // Default routing is recommended → flip to LLM.
    fireEvent.click(screen.getByTestId('kg-issue-routing-llm-o1'));
    fireEvent.click(screen.getByTestId('kg-refine-static-apply'));

    await waitFor(() => {
      expect(mock.applyStatic).toHaveBeenCalledTimes(1);
    });
    const [decisions] = mock.applyStatic.mock.calls[0];
    // Orphan + LLM routing → 'skip' (backend's skip_action raises
    // DeferredOrphanClassification, accumulating the node ids into
    // pendingOrphanClassification.nodeIds).
    expect(decisions).toEqual([{ issueId: 'o1', decision: 'skip' }]);
  });
});
