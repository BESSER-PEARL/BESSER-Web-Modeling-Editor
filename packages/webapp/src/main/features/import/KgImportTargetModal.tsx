// Asks where an imported OWL/RDF file should land when the active Knowledge
// Graph tab already has content: alongside the current graph (merge) or in a
// new tab. Skipped entirely when the active tab is empty — see
// `useImportOwlToKg`.
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
}) => {
  const { t } = useTranslation();
  return (
  <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
    <DialogContent className="sm:max-w-md" data-testid="kg-import-target-modal">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          {t('import.kg.targetModal.title')}
        </DialogTitle>
        {/* Node and edge counts pluralise independently, so each is its own
          * fragment; the tab-name clause is optional and composed the same way. */}
        <DialogDescription>
          <Trans
            i18nKey="import.kg.targetModal.description"
            values={{
              file: fileName,
              nodes: t('import.kg.targetModal.nodesFragment', { count: incomingNodeCount }),
              edges: t('import.kg.targetModal.edgesFragment', { count: incomingEdgeCount }),
              tab: currentTabTitle ? t('import.kg.targetModal.tabNameFragment', { title: currentTabTitle }) : '',
            }}
            components={{ file: <strong /> }}
          />
        </DialogDescription>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">{t('import.kg.targetModal.mergeExplainer')}</p>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} data-testid="kg-import-target-cancel">
          {t('common.cancel')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewTab}
          disabled={!canAddTab}
          title={canAddTab ? undefined : t('import.kg.targetModal.maxTabsReached')}
          data-testid="kg-import-target-new-tab"
        >
          <Layers className="mr-1.5 size-3.5" />
          {t('import.kg.targetModal.newTab')}
        </Button>
        <Button
          size="sm"
          onClick={onMerge}
          className="bg-brand text-brand-foreground hover:bg-brand-dark"
          data-testid="kg-import-target-merge"
        >
          <Merge className="mr-1.5 size-3.5" />
          {t('import.kg.targetModal.mergeIntoTab')}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
  );
};
