import React from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/** Confirmation prompt shown before a selection is permanently removed from
 *  the graph. Shared by every delete path — the inspector's "Delete selection"
 *  button and the canvas Delete/Backspace key — so both ask the same question
 *  with the same wording.
 *
 *  The strings still live under `editors.kg.inspector.confirm.*` (where the
 *  inspector's bulk delete introduced them) rather than being duplicated for
 *  the canvas path. */
export const KgDeleteConfirmDialog: React.FC<{
  open: boolean;
  nodeCount: number;
  relationCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, nodeCount, relationCount, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      open={open}
      title={t('editors.kg.inspector.confirm.bulkDeleteTitle')}
      /* Two independent counts, so each is pluralised separately and
       * composed -- i18next binds only one {{count}} per lookup. */
      description={t('editors.kg.inspector.confirm.bulkDeleteDescription', {
        nodes: t('editors.kg.inspector.confirm.bulkNodesFragment', { count: nodeCount }),
        relations: t('editors.kg.inspector.confirm.bulkRelationsFragment', { count: relationCount }),
      })}
      confirmLabel={t('editors.kg.inspector.confirm.bulkDeleteConfirm')}
      cancelLabel={t('common.cancel')}
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
