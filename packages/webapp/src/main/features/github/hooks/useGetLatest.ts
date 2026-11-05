/** Take in the branch head, after asking when that would replace unsaved edits. */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import { reportError } from '../../../shared/services/errors/reportError';

export function useGetLatest({
  pull,
  hasLocalChanges,
  setBusy,
}: {
  pull: () => Promise<void>;
  hasLocalChanges: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  return useCallback(async () => {
    if (hasLocalChanges) {
      const confirmed = await globalConfirm({
        title: t('github.linked.pullConfirmTitle'),
        description: t('github.linked.pullConfirmDescription'),
        confirmLabel: t('github.linked.pullConfirmAction'),
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await pull();
      toast.success(t('github.toasts.projectPulled'));
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error), { error });
    } finally {
      setBusy(false);
    }
  }, [pull, hasLocalChanges, setBusy, t]);
}
