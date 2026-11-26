import React, { Suspense, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  STORAGE_QUOTA_WARNING_EVENT,
  type StorageQuotaWarningDetail,
} from '../../shared/services/storage/localStorageQuota';
import { useHasOpened } from '../hooks/useHasOpened';

const StorageCleanupDialog = React.lazy(() =>
  import('../../features/project/StorageCleanupDialog').then((m) => ({ default: m.StorageCleanupDialog })),
);

const TOAST_ID = 'localStorage-quota-warning';
/** Long enough to read the instructions; hovering pauses it. */
const AUTO_CLOSE_MS = 20000;

const toMB = (bytes: number, digits = 1) => (bytes / (1024 * 1024)).toFixed(digits);

/**
 * Shows the "browser storage is nearly full" warning that `checkLocalStorageQuota`
 * announces, with the steps to free space and a button that opens the cleanup dialog.
 */
export const StorageQuotaWarning: React.FC = () => {
  const { t } = useTranslation();
  const [showCleanup, setShowCleanup] = useState(false);
  const cleanupMounted = useHasOpened(showCleanup);

  useEffect(() => {
    const onWarning = (event: Event) => {
      const { usageBytes, limitBytes } = (event as CustomEvent<StorageQuotaWarningDetail>).detail;
      toast.warning(
        <div className="flex flex-col items-start gap-2" data-testid="storage-quota-warning">
          <p className="font-medium">
            {t('shared.storageQuota.title', { used: toMB(usageBytes), limit: toMB(limitBytes, 0) })}
          </p>
          <p>{t('shared.storageQuota.instructions')}</p>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              toast.dismiss(TOAST_ID);
              setShowCleanup(true);
            }}
          >
            {t('shared.storageQuota.action')}
          </Button>
        </div>,
        { autoClose: AUTO_CLOSE_MS, toastId: TOAST_ID },
      );
    };
    window.addEventListener(STORAGE_QUOTA_WARNING_EVENT, onWarning);
    return () => window.removeEventListener(STORAGE_QUOTA_WARNING_EVENT, onWarning);
  }, [t]);

  if (!cleanupMounted) return null;
  return (
    <Suspense fallback={null}>
      <StorageCleanupDialog open={showCleanup} onOpenChange={setShowCleanup} />
    </Suspense>
  );
};
