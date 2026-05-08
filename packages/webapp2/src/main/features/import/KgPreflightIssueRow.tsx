// Single row in the KG preflight / refine modal.
//
// Every issue — including orphan-node groups — renders a leading
// checkbox so the user can opt out of fixing it entirely.
//
// Layout (rule-based modal, ``enableRoutingChoice`` off):
//   Checked:
//     [✓] Apply recommended: <label>
//
//   Unchecked:
//     [ ] Apply recommended: <label>          [SKIPPED]
//         <skip consequence text>  OR  [Fix in KG instead]
//
// Layout (refine modal, ``enableRoutingChoice`` on):
//   Checked:
//     [✓] Fix automatically
//         ( ) <recommended fix label>
//         ( ) Send to LLM
//
//   Unchecked:
//     [ ] Fix automatically                    [SKIPPED]
//
// In the refine layout there is NO bottom "Fix in KG instead" button —
// "Fix in KG" lives exclusively in the row header (alwaysShowFixInKg).
//
// When ``alwaysShowFixInKg`` is true an extra "Fix in KG" button is
// rendered in the header so users can defer any row to a manual fix
// without first having to uncheck it.
//
// The parent owns the ``decision`` and ``routing`` state; this
// component is purely presentational and emits changes via callbacks.
import React from 'react';
import { Button } from '@/components/ui/button';
import type { KgIssue } from './useKgPreflight';

export type RowDecision = 'accept' | 'skip';

export type RowRouting = 'recommended' | 'llm';

export interface KgPreflightIssueRowProps {
  issue: KgIssue;
  decision: RowDecision;
  onDecisionChange: (issueId: string, decision: RowDecision) => void;
  onFixInKg: (issue: KgIssue) => void;
  /**
   * When true, render a "Fix in KG" button in the row header that's
   * visible regardless of accept/skip state. Used by the LLM cleanup
   * modal where the manual-fix path is a peer to accept/skip rather
   * than a fallback inside the skip branch. Defaults to ``false`` to
   * preserve the rule-based preflight UX.
   */
  alwaysShowFixInKg?: boolean;
  /**
   * Optional segmented control rendered when the row is *selected*
   * (decision='accept'), letting the user pick how the issue should be
   * resolved: by applying the row's pre-computed recommendation, or by
   * deferring it to the LLM tab for AI-driven refinement.
   *
   * When ``enableRoutingChoice`` is true, the parent must also supply
   * ``routing`` and ``onRoutingChange``. Defaults to ``false`` so the
   * AI tab and the rule-based preflight modal keep their existing UX.
   */
  enableRoutingChoice?: boolean;
  routing?: RowRouting;
  onRoutingChange?: (issueId: string, routing: RowRouting) => void;
}

export const KgPreflightIssueRow: React.FC<KgPreflightIssueRowProps> = ({
  issue,
  decision,
  onDecisionChange,
  onFixInKg,
  alwaysShowFixInKg = false,
  enableRoutingChoice = false,
  routing = 'recommended',
  onRoutingChange,
}) => {
  const checkboxId = `kg-issue-${issue.id}`;
  const recommendedLabel = issue.recommendedAction?.label ?? 'No recommended action';
  const skipLabel = issue.skipAction?.label ?? 'Drop the element';
  const isAccepted = decision === 'accept';

  return (
    <div
      data-testid="kg-issue-row"
      data-issue-code={issue.code}
      className="flex flex-col gap-2 rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs font-mono uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {issue.code}
          </div>
          <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
            {issue.description}
          </div>
          {issue.affectedNodeIds.length > 0 && (
            <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
              Affects: {issue.affectedNodeIds.join(', ')}
            </div>
          )}
        </div>
        {alwaysShowFixInKg && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFixInKg(issue)}
            data-testid="kg-issue-fix-in-kg-header"
            className="shrink-0"
          >
            Fix in KG
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={isAccepted}
            onChange={(e) =>
              onDecisionChange(issue.id, e.target.checked ? 'accept' : 'skip')
            }
            aria-label={
              enableRoutingChoice
                ? `Fix automatically for ${issue.code}`
                : `Apply recommended fix for ${issue.code}`
            }
            className="h-4 w-4 cursor-pointer"
          />
          <span>
            {enableRoutingChoice ? (
              <span className="font-medium">Fix automatically</span>
            ) : (
              <>
                <span className="font-medium">Apply recommended:</span> {recommendedLabel}
              </>
            )}
          </span>
        </label>
        {!isAccepted && (
          <span
            data-testid="kg-issue-skipped-badge"
            className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            Skipped
          </span>
        )}
      </div>

      {enableRoutingChoice && isAccepted && onRoutingChange && (
        <div
          data-testid="kg-issue-routing"
          role="radiogroup"
          aria-label="Choose how to fix this issue"
          className="flex flex-col gap-1.5 pl-6 text-sm text-gray-700 dark:text-gray-300"
        >
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name={`kg-issue-routing-${issue.id}`}
              data-testid={`kg-issue-routing-recommended-${issue.id}`}
              checked={routing === 'recommended'}
              onChange={() => onRoutingChange(issue.id, 'recommended')}
              aria-checked={routing === 'recommended'}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer"
            />
            <span>{recommendedLabel}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name={`kg-issue-routing-${issue.id}`}
              data-testid={`kg-issue-routing-llm-${issue.id}`}
              checked={routing === 'llm'}
              onChange={() => onRoutingChange(issue.id, 'llm')}
              aria-checked={routing === 'llm'}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer"
            />
            <span>Send to LLM</span>
          </label>
        </div>
      )}

      {/* The "Fix in KG instead" button + skip-consequence text below the
          checkbox is part of the rule-based modal's UX where the only
          alternative to accepting was a manual fix. The refine modal
          surfaces "Fix in KG" exclusively in the header (alwaysShowFixInKg)
          and treats unchecked as a clean "don't fix" — no extra badge,
          no extra button below. */}
      {!enableRoutingChoice && !isAccepted && (
        <div
          data-testid="kg-issue-alternatives"
          className="flex flex-wrap items-center gap-2 pl-6 text-sm text-gray-700 dark:text-gray-300"
        >
          <span data-testid="kg-issue-skip-text">{skipLabel}</span>
          <span className="font-medium uppercase text-gray-500 dark:text-gray-400">or</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFixInKg(issue)}
            data-testid="kg-issue-fix-in-kg"
          >
            Fix in KG instead
          </Button>
        </div>
      )}
    </div>
  );
};
