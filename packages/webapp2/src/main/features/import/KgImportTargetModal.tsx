// Asks where an imported OWL/RDF file should land when the active Knowledge
// Graph tab already has content: alongside the current graph (merge) or in a
// new tab. Skipped entirely when the active tab is empty — see
// `useImportOwlToKg`.
import React from 'react';
import { AlertTriangle, Layers, Merge } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface KgImportTargetModalProps {
  open: boolean;
  fileName: string;
  /** Title of the Knowledge Graph tab that is currently active. */
  currentTabTitle: string;
  incomingNodeCount: number;
  incomingEdgeCount: number;
  /** False when the project already holds the maximum number of KG tabs. */
  canAddTab: boolean;
  onMerge: () => void;
  onNewTab: () => void;
  onCancel: () => void;
}

export const KgImportTargetModal: React.FC<KgImportTargetModalProps> = ({
  open,
  fileName,
  currentTabTitle,
  incomingNodeCount,
  incomingEdgeCount,
  canAddTab,
  onMerge,
  onNewTab,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
    <DialogContent className="sm:max-w-md" data-testid="kg-import-target-modal">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          Where should this graph go?
        </DialogTitle>
        <DialogDescription>
          <strong>{fileName}</strong> contains {incomingNodeCount} node
          {incomingNodeCount === 1 ? '' : 's'} and {incomingEdgeCount} edge
          {incomingEdgeCount === 1 ? '' : 's'}. The current tab
          {currentTabTitle ? ` (${currentTabTitle})` : ''} is not empty — add the
          import alongside what is already there, or keep it separate in a new tab.
        </DialogDescription>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Merging keeps the current graph as-is and only adds what is missing: terms
        that both graphs share (same IRI) stay a single node.
      </p>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} data-testid="kg-import-target-cancel">
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewTab}
          disabled={!canAddTab}
          title={canAddTab ? undefined : 'This project already has the maximum number of Knowledge Graph tabs.'}
          data-testid="kg-import-target-new-tab"
        >
          <Layers className="mr-1.5 size-3.5" />
          New tab
        </Button>
        <Button
          size="sm"
          onClick={onMerge}
          className="bg-brand text-brand-foreground hover:bg-brand-dark"
          data-testid="kg-import-target-merge"
        >
          <Merge className="mr-1.5 size-3.5" />
          Merge into this tab
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
