// Single row in the KG preflight modal.
//
// Renders one ``KGIssue``: description, an "Apply recommended"
// checkbox, and — when the user unchecks it — a visual indication
// that the element will be skipped plus a single "Fix in KG instead"
// button.
//
// Layout:
//   Checked:
//     [✓] Apply recommended: <label>
//
//   Unchecked:
//     [ ] Apply recommended: <label>          [SKIPPED]
//         <skip consequence text>  OR  [Fix in KG instead]
//
// The checkbox label is stable ("Apply recommended: …"); a coloured
// "SKIPPED" badge in the top-right shows the user has opted out, and
// the consequence text spells out what dropping the element will do.
// "Fix in KG instead" closes the modal so the user can edit.
//
// The parent owns the ``decision`` state per row; this component is
// purely presentational and emits state changes via callbacks.
import React from 'react';
import { Button } from '@/components/ui/button';
import type { KgIssue } from './useKgPreflight';

export type RowDecision = 'accept' | 'skip';

export interface KgPreflightIssueRowProps {
  issue: KgIssue;
  decision: RowDecision;
  onDecisionChange: (issueId: string, decision: RowDecision) => void;
  onFixInKg: (issue: KgIssue) => void;
}

export const KgPreflightIssueRow: React.FC<KgPreflightIssueRowProps> = ({
  issue,
  decision,
  onDecisionChange,
  onFixInKg,
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
            aria-label={`Apply recommended fix for ${issue.code}`}
            className="h-4 w-4 cursor-pointer"
          />
          <span>
            <span className="font-medium">Apply recommended:</span> {recommendedLabel}
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

      {!isAccepted && (
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
