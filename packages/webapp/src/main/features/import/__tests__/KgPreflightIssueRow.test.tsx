/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

import { KgPreflightIssueRow } from '../KgPreflightIssueRow';
import type { KgIssue } from '../useKgPreflight';

const _issue = (overrides: Partial<KgIssue> = {}): KgIssue => ({
  id: 'i1',
  code: 'CODE',
  description: 'desc',
  affectedNodeIds: ['n1'],
  affectedEdgeIds: [],
  recommendedAction: { key: 'attach_to_thing', parameters: {}, label: 'Apply X' },
  skipAction: { key: 'drop_property', parameters: {}, label: 'Skip X' },
  ...overrides,
});

describe('KgPreflightIssueRow alwaysShowFixInKg', () => {
  it('does not render the header Fix-in-KG button by default', () => {
    render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('kg-issue-fix-in-kg-header')).not.toBeInTheDocument();
  });

  it('renders the header Fix-in-KG button when alwaysShowFixInKg is true (decision=accept)', () => {
    const onFixInKg = vi.fn();
    render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={onFixInKg}
        alwaysShowFixInKg
      />,
    );
    const button = screen.getByTestId('kg-issue-fix-in-kg-header');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onFixInKg).toHaveBeenCalledTimes(1);
    expect(onFixInKg.mock.calls[0][0].id).toBe('i1');
    // The accept-state alternatives section is still NOT rendered.
    expect(screen.queryByTestId('kg-issue-alternatives')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kg-issue-skipped-badge')).not.toBeInTheDocument();
  });

  it('header Fix-in-KG button is also visible when decision=skip', () => {
    render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="skip"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        alwaysShowFixInKg
      />,
    );
    // Both the header button (always-on) and the alternatives' Fix-in-KG
    // button (skip-only) are present — they target the same handler so
    // having both is fine, just gives the user two click targets.
    expect(screen.getByTestId('kg-issue-fix-in-kg-header')).toBeInTheDocument();
    expect(screen.getByTestId('kg-issue-fix-in-kg')).toBeInTheDocument();
  });
});

describe('KgPreflightIssueRow enableRoutingChoice', () => {
  it('does not render the routing toggle by default', () => {
    render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('kg-issue-routing')).not.toBeInTheDocument();
  });

  it('renders the routing toggle only when enabled AND decision=accept', () => {
    const { rerender } = render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('kg-issue-routing')).toBeInTheDocument();
    expect(screen.getByTestId('kg-issue-routing-recommended-i1')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('kg-issue-routing-llm-i1')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    // Skipping the row hides the routing toggle.
    rerender(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="skip"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('kg-issue-routing')).not.toBeInTheDocument();
  });

  it('clicking LLM fires onRoutingChange with the new routing', () => {
    const onRoutingChange = vi.fn();
    render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={onRoutingChange}
      />,
    );
    fireEvent.click(screen.getByTestId('kg-issue-routing-llm-i1'));
    expect(onRoutingChange).toHaveBeenCalledWith('i1', 'llm');
  });

  it('checkbox label reads "Fix automatically" with routing on (not "Apply recommended")', () => {
    render(
      <KgPreflightIssueRow
        issue={_issue({ recommendedAction: { key: 'drop_node', parameters: {}, label: 'Drop 1 orphan node' } })}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Fix automatically')).toBeInTheDocument();
    expect(screen.queryByText(/Apply recommended:/)).not.toBeInTheDocument();
  });

  it('recommended radio label is the recommendedAction.label (e.g. "Drop 1 orphan node")', () => {
    render(
      <KgPreflightIssueRow
        issue={_issue({ recommendedAction: { key: 'drop_node', parameters: {}, label: 'Drop 1 orphan node' } })}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={vi.fn()}
      />,
    );
    const recRadio = screen.getByTestId('kg-issue-routing-recommended-i1');
    // The radio is inside a <label>, so the label's text content carries
    // the recommendation text.
    expect(recRadio.closest('label')?.textContent).toContain('Drop 1 orphan node');
    expect(
      screen.getByTestId('kg-issue-routing-llm-i1').closest('label')?.textContent,
    ).toContain('Send to LLM');
  });

  it('no bottom "Fix in KG instead" button when enableRoutingChoice is on (regardless of decision)', () => {
    const { rerender } = render(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="skip"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('kg-issue-fix-in-kg')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kg-issue-alternatives')).not.toBeInTheDocument();

    rerender(
      <KgPreflightIssueRow
        issue={_issue()}
        decision="accept"
        onDecisionChange={vi.fn()}
        onFixInKg={vi.fn()}
        enableRoutingChoice
        routing="recommended"
        onRoutingChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('kg-issue-fix-in-kg')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kg-issue-alternatives')).not.toBeInTheDocument();
  });
});
