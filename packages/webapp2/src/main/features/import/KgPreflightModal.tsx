// KG → BUML preflight review modal.
//
// Opens when the user triggers "Convert KG → Class/Object Diagram" and
// the backend's preflight reports at least one issue. Renders one
// ``KgPreflightIssueRow`` per issue. The user clicks "Convert" to send
// the resolutions to the backend, "Cancel" to abort, or "Fix in KG" on
// any individual row to close the modal so they can edit the KG.
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { KgIssue, KgPreflightReport } from './useKgPreflight';
import { KgPreflightIssueRow, type RowDecision } from './KgPreflightIssueRow';

export interface KgPreflightModalProps {
  open: boolean;
  report: KgPreflightReport | null;
  diagramTypeLabel: string;
  onConvert: (resolutions: Array<{ issueId: string; decision: RowDecision }>, kgSignature: string) => void;
  onCancel: () => void;
  onFixInKg: (issue: KgIssue) => void;
}

function _initialDecisions(issues: KgIssue[]): Record<string, RowDecision> {
  const out: Record<string, RowDecision> = {};
  for (const issue of issues) {
    out[issue.id] = 'accept';
  }
  return out;
}

export const KgPreflightModal: React.FC<KgPreflightModalProps> = ({
  open,
  report,
  diagramTypeLabel,
  onConvert,
  onCancel,
  onFixInKg,
}) => {
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});

  // Reset decisions whenever a new report arrives.
  useEffect(() => {
    if (report) {
      setDecisions(_initialDecisions(report.issues));
    } else {
      setDecisions({});
    }
  }, [report]);

  const handleDecisionChange = (issueId: string, decision: RowDecision) => {
    setDecisions((prev) => ({ ...prev, [issueId]: decision }));
  };

  const handleConvert = () => {
    if (!report) return;
    const resolutions = report.issues.map((i) => ({
      issueId: i.id,
      decision: decisions[i.id] ?? 'accept',
    }));
    onConvert(resolutions, report.kgSignature);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review before converting to {diagramTypeLabel}</DialogTitle>
          <DialogDescription>
            The Knowledge Graph contains elements that don&apos;t map 1-to-1 to BUML.
            For each one, accept the recommended fix, fix it manually in the KG, or
            skip it (drop from the output).
          </DialogDescription>
        </DialogHeader>

        <div
          data-testid="kg-preflight-issue-list"
          className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto"
        >
          {report?.issues.map((issue) => (
            <KgPreflightIssueRow
              key={issue.id}
              issue={issue}
              decision={decisions[issue.id] ?? 'accept'}
              onDecisionChange={handleDecisionChange}
              onFixInKg={onFixInKg}
            />
          ))}
          {report && report.issues.length === 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              No inconsistencies detected. Click Convert to proceed.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="kg-preflight-cancel">
            Cancel
          </Button>
          <Button onClick={handleConvert} data-testid="kg-preflight-convert">
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
