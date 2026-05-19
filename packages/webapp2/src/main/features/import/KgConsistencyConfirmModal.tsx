// Pre-conversion warning modal. Surfaces inconsistencies returned by
// /check-kg-consistency just before the KG → ClassDiagram conversion is
// triggered. The user can:
//   - "Open Refine to fix": closes this modal and opens KgRefineModal on
//     the Consistency tab.
//   - "Proceed anyway": closes the modal and runs the conversion.
//   - "Cancel": aborts the conversion entirely.
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ConsistencyIssue, ConsistencyReport } from '../../shared/types/project';

export interface KgConsistencyConfirmModalProps {
  open: boolean;
  report: ConsistencyReport | null;
  onOpenRefine: () => void;
  onProceed: () => void;
  onCancel: () => void;
}

export const KgConsistencyConfirmModal: React.FC<KgConsistencyConfirmModalProps> = ({
  open,
  report,
  onOpenRefine,
  onProceed,
  onCancel,
}) => {
  const issues = report?.issues ?? [];
  const counts = report?.severityCounts ?? { violation: 0, warning: 0, info: 0 };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Knowledge Graph has inconsistencies</DialogTitle>
          <DialogDescription>
            The OWL/SHACL consistency check found {issues.length} issue
            {issues.length === 1 ? '' : 's'} in the Knowledge Graph
            ({counts.violation} violation{counts.violation === 1 ? '' : 's'},{' '}
            {counts.warning} warning{counts.warning === 1 ? '' : 's'},{' '}
            {counts.info} info). You can fix them, proceed with the conversion
            anyway, or cancel.
          </DialogDescription>
        </DialogHeader>

        <ul
          className="max-h-[360px] divide-y divide-border overflow-y-auto rounded border border-border"
          data-testid="kg-consistency-confirm-issue-list"
        >
          {issues.map((issue: ConsistencyIssue) => {
            const tone =
              issue.severity === 'violation'
                ? 'border-l-4 border-l-red-500'
                : issue.severity === 'warning'
                  ? 'border-l-4 border-l-amber-500'
                  : 'border-l-4 border-l-sky-500';
            return (
              <li
                key={issue.id}
                className={`px-3 py-2 text-sm ${tone}`}
                data-testid={`kg-consistency-confirm-issue-${issue.id}`}
              >
                {issue.constraint_label ? (
                  <>
                    <div className="font-medium">{issue.constraint_label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{issue.message}</div>
                  </>
                ) : (
                  <div className="font-medium">{issue.message}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">
                    {issue.severity}
                  </span>
                  {issue.spec_kind && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
                      {issue.spec_kind}
                    </span>
                  )}
                  {issue.affected_node_ids.length > 0 && (
                    <span className="truncate">on {issue.affected_node_ids[0]}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onCancel} data-testid="kg-consistency-confirm-cancel">
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onOpenRefine}
              data-testid="kg-consistency-confirm-open-refine"
            >
              Open Refine to fix
            </Button>
            <Button onClick={onProceed} data-testid="kg-consistency-confirm-proceed">
              Proceed anyway
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
