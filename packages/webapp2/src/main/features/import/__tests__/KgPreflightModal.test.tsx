/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { KgPreflightModal } from '../KgPreflightModal';
import type { KgPreflightReport } from '../useKgPreflight';

const _issue = (id: string, code: string, description: string) => ({
  id,
  code,
  description,
  affectedNodeIds: [`${id}-node`],
  affectedEdgeIds: [],
  recommendedAction: { key: 'attach_to_thing', parameters: {}, label: `Recommended for ${code}` },
  skipAction: { key: 'drop_property', parameters: {}, label: `Skip for ${code}` },
});

const _report = (issues: ReturnType<typeof _issue>[]): KgPreflightReport => ({
  kgSignature: 'sig-abc',
  diagramType: 'ClassDiagram',
  issueCount: issues.length,
  issues,
});

describe('KgPreflightModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one row per issue with checkbox checked by default', () => {
    const report = _report([
      _issue('i1', 'PROPERTY_NO_DOMAIN', 'Property has no domain'),
      _issue('i2', 'BLANK_NODE_INSTANCE', 'Blank node used as instance'),
    ]);
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );

    const rows = screen.getAllByTestId('kg-issue-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText(/Property has no domain/)).toBeInTheDocument();
    expect(screen.getByText(/Blank node used as instance/)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it('uncheck shows a SKIPPED badge + skip consequence + Fix-in-KG button; checkbox label stays "Apply recommended"', () => {
    const report = _report([_issue('i1', 'PROPERTY_NO_DOMAIN', 'desc')]);
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    // Before unchecking: "Apply recommended" label, no badge, no alternatives.
    expect(screen.getByText(/Apply recommended:/)).toBeInTheDocument();
    expect(screen.queryByTestId('kg-issue-skipped-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kg-issue-alternatives')).not.toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    // Checkbox label stays "Apply recommended".
    expect(screen.getByText(/Apply recommended:/)).toBeInTheDocument();
    // SKIPPED badge appears.
    expect(screen.getByTestId('kg-issue-skipped-badge')).toHaveTextContent(/Skipped/i);
    // Consequence text + Fix-in-KG button appear below.
    expect(screen.getByTestId('kg-issue-alternatives')).toBeInTheDocument();
    expect(screen.getByTestId('kg-issue-skip-text')).toHaveTextContent(/Skip for PROPERTY_NO_DOMAIN/);
    expect(screen.getByTestId('kg-issue-fix-in-kg')).toHaveTextContent(/Fix in KG instead/);
    // No standalone Skip button.
    expect(screen.queryByTestId('kg-issue-skip')).not.toBeInTheDocument();
  });

  it('Convert sends accept decisions for all rows by default', () => {
    const report = _report([
      _issue('i1', 'CODE1', 'a'),
      _issue('i2', 'CODE2', 'b'),
    ]);
    const onConvert = vi.fn();
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={onConvert}
        onCancel={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('kg-preflight-convert'));
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledWith(
      [
        { issueId: 'i1', decision: 'accept' },
        { issueId: 'i2', decision: 'accept' },
      ],
      'sig-abc',
    );
  });

  it('Convert sends skip decisions for unchecked rows (uncheck = skip)', () => {
    const report = _report([_issue('i1', 'CODE1', 'a'), _issue('i2', 'CODE2', 'b')]);
    const onConvert = vi.fn();
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={onConvert}
        onCancel={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );

    // Unchecking a row alone is enough to set its decision to skip; no
    // separate Skip button to click anymore.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByTestId('kg-preflight-convert'));
    expect(onConvert).toHaveBeenCalledWith(
      [
        { issueId: 'i1', decision: 'skip' },
        { issueId: 'i2', decision: 'accept' },
      ],
      'sig-abc',
    );
  });

  it('Fix-in-KG fires onFixInKg with the issue payload', () => {
    const report = _report([_issue('i1', 'CODE1', 'a')]);
    const onFixInKg = vi.fn();
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        onFixInKg={onFixInKg}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox')); // uncheck
    fireEvent.click(screen.getByTestId('kg-issue-fix-in-kg'));
    expect(onFixInKg).toHaveBeenCalledTimes(1);
    expect(onFixInKg.mock.calls[0][0]).toMatchObject({ id: 'i1', code: 'CODE1' });
  });

  it('Cancel fires onCancel', () => {
    const report = _report([_issue('i1', 'CODE1', 'a')]);
    const onCancel = vi.fn();
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={vi.fn()}
        onCancel={onCancel}
        onFixInKg={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('kg-preflight-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders empty-state message when issue list is empty', () => {
    const report = _report([]);
    render(
      <KgPreflightModal
        open
        report={report}
        diagramTypeLabel="Class Diagram"
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );
    expect(screen.getByText(/No inconsistencies detected/)).toBeInTheDocument();
  });
});
