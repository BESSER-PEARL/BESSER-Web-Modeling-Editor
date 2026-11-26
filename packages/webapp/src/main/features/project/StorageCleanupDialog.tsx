import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Download, HardDrive, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, dialogDisplayTitleClass } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useProject } from '../../app/hooks/useProject';
import { useConfirmDialog } from '../../shared/hooks/useConfirmDialog';
import { reportError } from '../../shared/services/errors/reportError';
import { track, trackFailure } from '../../shared/services/analytics/events';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getLocalStorageUsageBytes, QUOTA_LIMIT_BYTES } from '../../shared/services/storage/localStorageQuota';
import {
  deleteStoredProjects,
  listStoredProjects,
  type StoredProjectSummary,
} from '../../shared/services/storage/storageCleanup';

interface StorageCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MB = 1024 * 1024;

/** "1.2 MB", or "340 KB" below a tenth of a megabyte. */
export function formatStorageSize(bytes: number): string {
  if (bytes < MB / 10) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/**
 * Lists the projects saved in this browser with their size and last edit, so
 * the user can export and then delete old ones when localStorage is nearly full.
 * The open project cannot be selected, and nothing is deleted without a confirm.
 */
export const StorageCleanupDialog: React.FC<StorageCleanupDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const { currentProject, exportProject } = useProject();
  const currentProjectId = currentProject?.id ?? null;
  const { confirm, dialogState, handleConfirm, handleCancel } = useConfirmDialog();

  const [projects, setProjects] = useState<StoredProjectSummary[]>([]);
  const [usageBytes, setUsageBytes] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(() => {
    const listed = listStoredProjects(currentProjectId);
    setProjects(listed);
    setUsageBytes(getLocalStorageUsageBytes());
    setSelected((previous) => new Set(listed.filter((p) => !p.isProtected && previous.has(p.id)).map((p) => p.id)));
  }, [currentProjectId]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    refresh();
  }, [open, refresh]);

  const selectedProjects = useMemo(() => projects.filter((p) => selected.has(p.id)), [projects, selected]);
  const selectedBytes = selectedProjects.reduce((sum, p) => sum + p.sizeBytes, 0);

  const toggle = (projectId: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(projectId);
      else next.delete(projectId);
      return next;
    });
  };

  const handleExport = async (project: StoredProjectSummary) => {
    try {
      await exportProject(project.id, true);
    } catch (error) {
      reportError(t('project.storageCleanup.toasts.exportFailed', { name: project.name }), { error });
    }
  };

  const handleDelete = async () => {
    if (selectedProjects.length === 0) return;
    const confirmed = await confirm({
      title: t('project.storageCleanup.confirm.title', { count: selectedProjects.length }),
      description: t('project.storageCleanup.confirm.description', {
        count: selectedProjects.length,
        names: selectedProjects.map((p) => `"${p.name}"`).join(', '),
        size: formatStorageSize(selectedBytes),
      }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      setIsBusy(true);
      const result = deleteStoredProjects(selectedProjects.map((p) => p.id), currentProjectId);
      const remaining = ProjectStorageRepository.getAllProjects().length;
      result.deleted.forEach(() => track('project_deleted', { remaining_projects: remaining }));
      toast.success(
        t('project.storageCleanup.toasts.deleted', {
          count: result.deleted.length,
          size: formatStorageSize(result.freedBytes),
        }),
      );
    } catch (error) {
      trackFailure('project_delete_failed', error, {});
      reportError(t('project.storageCleanup.toasts.deleteFailed'), { error });
    } finally {
      setIsBusy(false);
      refresh();
    }
  };

  const usagePercent = Math.min(100, Math.round((usageBytes / QUOTA_LIMIT_BYTES) * 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="storage-cleanup-dialog">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2', dialogDisplayTitleClass)}>
            <HardDrive className="size-5 text-brand" />
            {t('project.storageCleanup.title')}
          </DialogTitle>
          <DialogDescription>{t('project.storageCleanup.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t('project.storageCleanup.usage', {
                used: formatStorageSize(usageBytes),
                limit: formatStorageSize(QUOTA_LIMIT_BYTES),
              })}
            </span>
            <span>{usagePercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {/* Width is the live usage, which no fixed utility class can express. */}
            <div
              className={cn('h-full rounded-full', usagePercent >= 80 ? 'bg-destructive' : 'bg-brand')}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.storageCleanup.empty')}</p>
        ) : (
          <ul className="flex max-h-[45vh] flex-col divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/60">
            {projects.map((project) => {
              const checkboxId = `storage-cleanup-${project.id}`;
              return (
                <li key={project.id} className="flex items-center gap-3 px-3 py-2.5" data-testid="storage-cleanup-row">
                  <Checkbox
                    id={checkboxId}
                    checked={selected.has(project.id)}
                    onCheckedChange={(checked) => toggle(project.id, checked === true)}
                    disabled={project.isProtected || isBusy}
                    aria-label={t('project.storageCleanup.selectAria', { name: project.name })}
                  />
                  <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{project.name}</span>
                      {project.isProtected && (
                        <Badge className="shrink-0 rounded-full border-brand/20 bg-brand/10 px-2 py-0 text-[10px] font-medium text-brand">
                          {t('project.storageCleanup.openBadge')}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-3 font-mono text-[10px] tracking-wide text-muted-foreground">
                      <span>{formatStorageSize(project.sizeBytes)}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {t('project.storageCleanup.lastModified', {
                          date: new Date(project.lastModified).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }),
                        })}
                      </span>
                    </span>
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleExport(project)}
                    disabled={isBusy}
                    aria-label={t('project.storageCleanup.exportAria', { name: project.name })}
                  >
                    <Download className="size-3.5" />
                    {t('project.storageCleanup.export')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">{t('project.storageCleanup.hint')}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {t('common.close')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={isBusy || selectedProjects.length === 0}
            data-testid="storage-cleanup-delete"
          >
            <Trash2 className="size-4" />
            {selectedProjects.length === 0
              ? t('project.storageCleanup.deleteNone')
              : t('project.storageCleanup.deleteSelected', {
                  count: selectedProjects.length,
                  size: formatStorageSize(selectedBytes),
                })}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.confirmLabel}
        cancelLabel={dialogState.cancelLabel}
        variant={dialogState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Dialog>
  );
};
