import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CalendarDays,
  FileSpreadsheet,
  FolderOpen,
  Layers3,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import { BesserProject, PerspectiveSettings } from '../../shared/types/project';
import { PERSPECTIVES, perspectivesFromDiagramList } from '../../shared/perspectives';
import { useProject } from '../../app/hooks/useProject';
import { useConfirmDialog } from '../../shared/hooks/useConfirmDialog';
import { useFieldValidation } from '../../shared/hooks/useFieldValidation';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { importProject } from '../../shared/services/project-import/projectImport';
import { normalizeProjectName } from '../../shared/utils/projectName';
import { validateProjectName } from '../../shared/utils/validation';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useImportDiagramToProject } from '../import/useImportDiagram';

interface ProjectHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProjectHubStep = 'start' | 'create' | 'import' | 'spreadsheet' | 'open';

const defaultForm = {
  name: 'New_Project',
  description: 'Modern workspace project for UML, GUI and quantum modeling.',
  owner: 'BESSER User',
};

// Default to "Show All" so the create-project flow preserves the prior default
// of all-diagrams-visible when the user doesn't pick a perspective explicitly.
const DEFAULT_PERSPECTIVE_KEY = 'all';

// Apply a perspective preset at project-creation time. We can't reuse
// `applyPerspectivePresetThunk` here because the project doesn't exist yet —
// that thunk mutates `currentProject`, but in this flow there is no current
// project to mutate. Instead we compute the preset and pass it through
// `createProjectThunk` so the very first persisted state already has the
// chosen perspective. Keep this in lockstep with `applyPerspectivePresetThunk`
// (workspaceSlice.ts) so the two paths don't drift in how they map a preset
// key to a `PerspectiveSettings` map.
const resolvePerspectives = (key: string): PerspectiveSettings | undefined => {
  const preset = PERSPECTIVES.find((p) => p.key === key);
  return preset ? perspectivesFromDiagramList(preset.diagrams) : undefined;
};

const readableFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ProjectHubDialog: React.FC<ProjectHubDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<BesserProject[]>([]);
  const [step, setStep] = useState<ProjectHubStep>('start');
  const [form, setForm] = useState(defaultForm);
  const [createPerspectiveKey, setCreatePerspectiveKey] = useState<string>(DEFAULT_PERSPECTIVE_KEY);
  const [spreadsheetForm, setSpreadsheetForm] = useState(defaultForm);
  const [spreadsheetPerspectiveKey, setSpreadsheetPerspectiveKey] = useState<string>(DEFAULT_PERSPECTIVE_KEY);
  const [spreadsheetFiles, setSpreadsheetFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const spreadsheetFileInputRef = useRef<HTMLInputElement | null>(null);

  const { currentProject, createProject, loadProject, deleteProject } = useProject();
  const importDiagramToProject = useImportDiagramToProject();
  const { confirm, dialogState, handleConfirm, handleCancel } = useConfirmDialog();
  const canClose = Boolean(currentProject);

  // ── Inline validation for the "Create" form ──────────────────────────
  const createValidators = useMemo(() => ({
    name: () => validateProjectName(form.name),
  }), [form.name]);
  const createValidation = useFieldValidation(createValidators);

  // ── Inline validation for the "Spreadsheet" form ─────────────────────
  const spreadsheetValidators = useMemo(() => ({
    name: () => validateProjectName(spreadsheetForm.name),
  }), [spreadsheetForm.name]);
  const spreadsheetValidation = useFieldValidation(spreadsheetValidators);

  const refreshProjects = useCallback(() => {
    const all = ProjectStorageRepository.getAllProjects();
    setProjects(all as BesserProject[]);
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [projects],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    refreshProjects();
    setStep('start');
    setForm(defaultForm);
    setCreatePerspectiveKey(DEFAULT_PERSPECTIVE_KEY);
    setSpreadsheetForm(defaultForm);
    setSpreadsheetPerspectiveKey(DEFAULT_PERSPECTIVE_KEY);
    setSpreadsheetFiles([]);
    createValidation.resetTouched();
    spreadsheetValidation.resetTouched();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshProjects]);

  const currentStepInfo = useMemo(() => {
    if (step === 'create') {
      return {
        title: t('project.hub.create.title'),
        description: t('project.hub.create.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'import') {
      return {
        title: t('project.hub.import.title'),
        description: t('project.hub.import.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'spreadsheet') {
      return {
        title: t('project.hub.spreadsheet.title'),
        description: t('project.hub.spreadsheet.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'open') {
      return {
        title: t('project.hub.open.title'),
        description: t('project.hub.open.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    return {
      title: t('project.hub.start.title'),
      description: t('project.hub.start.description'),
      badge: t('project.hub.stepBadge', { current: 1, total: 2 }),
    };
  }, [step, t]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !canClose) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleCreateProject = async () => {
    const errors = createValidation.touchAll();
    if (Object.keys(errors).length > 0) {
      return;
    }

    const name = normalizeProjectName(form.name);
    const description = form.description.trim();
    const owner = form.owner.trim();

    try {
      setIsBusy(true);
      await createProject(
        name,
        description || defaultForm.description,
        owner || defaultForm.owner,
        resolvePerspectives(createPerspectiveKey),
      );
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toast.created', { name }));
    } catch (error) {
      toast.error(t('project.hub.toast.createFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenProject = async (projectId: string) => {
    try {
      setIsBusy(true);
      await loadProject(projectId);
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toast.loaded'));
    } catch (error) {
      toast.error(t('project.hub.toast.loadFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const confirmed = await confirm({
      title: t('project.hub.deleteConfirm.title'),
      description: t('project.hub.deleteConfirm.description', { name: projectName }),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      setIsBusy(true);
      await deleteProject(projectId);
      refreshProjects();
      toast.success(t('project.hub.toast.deleted', { name: projectName }));
    } catch (error) {
      toast.error(t('project.hub.toast.deleteFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsBusy(true);
      const importedProject = await importProject(file);
      await loadProject(importedProject.id);
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toast.imported', { name: importedProject.name }));
    } catch (error) {
      toast.error(t('project.hub.toast.importFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
      event.target.value = '';
    }
  };

  const handleImportDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'json' && ext !== 'py') {
      toast.error(t('project.hub.toast.unsupportedFileType'));
      return;
    }
    try {
      setIsBusy(true);
      const importedProject = await importProject(file);
      await loadProject(importedProject.id);
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toast.imported', { name: importedProject.name }));
    } catch (error) {
      toast.error(t('project.hub.toast.importFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSpreadsheetFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSpreadsheetFiles(files);
  };

  const handleStartFromSpreadsheet = async () => {
    const errors = spreadsheetValidation.touchAll();
    if (Object.keys(errors).length > 0) {
      return;
    }

    const name = normalizeProjectName(spreadsheetForm.name);
    const description = spreadsheetForm.description.trim();
    const owner = spreadsheetForm.owner.trim();

    if (spreadsheetFiles.length === 0) {
      toast.error(t('project.hub.toast.noSpreadsheetFile'));
      return;
    }

    try {
      setIsBusy(true);
      await createProject(
        name,
        description || defaultForm.description,
        owner || defaultForm.owner,
        resolvePerspectives(spreadsheetPerspectiveKey),
      );

      const requestData = new FormData();
      spreadsheetFiles.forEach((file) => requestData.append('files', file));

      const response = await fetch(`${BACKEND_URL}/csv-to-domain-model`, {
        method: 'POST',
        body: requestData,
      });

      if (!response.ok) {
        let message = t('project.hub.toast.spreadsheetGenerateFailed');
        try {
          const errorData = await response.json();
          if (typeof errorData?.detail === 'string') {
            message = errorData.detail;
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(message);
      }

      const diagramJson = await response.json();
      const generatedDiagramFile = new File(
        [JSON.stringify(diagramJson)],
        `${name}_class_diagram.json`,
        { type: 'application/json' },
      );

      await importDiagramToProject(generatedDiagramFile);
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toast.spreadsheetCreated', { name }));
    } catch (error) {
      toast.error(t('project.hub.toast.spreadsheetImportFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const renderPerspectivePicker = (
    selected: string,
    onSelect: (key: string) => void,
    idPrefix: string,
  ) => (
    <FormField
      label={t('project.hub.perspective.label')}
      htmlFor={`${idPrefix}-perspective`}
      helperText={t('project.hub.perspective.helper')}
    >
      <div
        id={`${idPrefix}-perspective`}
        role="radiogroup"
        aria-label={t('project.hub.perspective.label')}
        className="flex flex-wrap gap-2"
      >
        {PERSPECTIVES.map((preset) => {
          const active = preset.key === selected;
          return (
            <Button
              key={preset.key}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="sm"
              role="radio"
              aria-checked={active}
              title={preset.description}
              onClick={() => onSelect(preset.key)}
              data-testid={`${idPrefix}-perspective-${preset.key}`}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </FormField>
  );

  const renderProjectList = () => (
    <div className="flex flex-col gap-3">
      {sortedProjects.length === 0 && (
        <Card className="border-dashed border-border/80 bg-muted/20 shadow-none">
          <CardContent className="py-6 text-sm text-muted-foreground">
            {t('project.hub.list.emptyHint')}
          </CardContent>
        </Card>
      )}

      {sortedProjects.map((project) => {
        const isCurrent = currentProject?.id === project.id;
        return (
          <Card key={project.id} className={isCurrent ? 'border-brand/40 bg-brand/5 shadow-none' : 'shadow-none'}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{project.description || t('project.hub.list.noDescription')}</p>
                </div>
                {isCurrent && <Badge className="border-brand/20 bg-brand/10 text-brand">{t('project.hub.list.active')}</Badge>}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span>{new Date(project.createdAt).toLocaleString()}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleOpenProject(project.id)}
                  disabled={isBusy}
                  className="flex-1 gap-1.5 border-brand/20 text-brand hover:border-brand/30 hover:bg-brand/[0.04]"
                >
                  <FolderOpen className="size-3.5" />
                  {t('project.hub.list.open')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void handleDeleteProject(project.id, project.name)}
                  disabled={isBusy}
                  aria-label={t('project.hub.list.deleteAria', { name: project.name })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={cn('max-h-[92vh] overflow-hidden p-0', !canClose && '[&>button]:hidden')}>
        <DialogHeader className="border-b border-border/60 px-6 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className={cn(step === 'start' && 'flex items-start gap-3.5')}>
              {step === 'start' && (
                <img src="/images/logo.png" alt="BESSER" className="mt-0.5 h-7 w-auto shrink-0 brightness-0 opacity-80 dark:invert" />
              )}
              <div>
                <DialogTitle className={cn(
                  'text-xl tracking-tight',
                  step === 'start' && 'font-display text-2xl',
                )}>
                  {currentStepInfo.title}
                </DialogTitle>
                <DialogDescription className="mt-1">{currentStepInfo.description}</DialogDescription>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 rounded-full border-brand/15 bg-brand/[0.06] font-mono text-[10px] tracking-wider text-brand">
              {currentStepInfo.badge}
            </Badge>
          </div>
        </DialogHeader>

        <input
          ref={importFileInputRef}
          type="file"
          accept=".json,.py"
          className="hidden"
          onChange={handleImportProjectFile}
        />
        <input
          ref={spreadsheetFileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          multiple
          className="hidden"
          onChange={handleSpreadsheetFileSelect}
        />

        <div className="max-h-[75vh] overflow-y-auto px-6 py-4">
          {step === 'start' && (
            <div className="flex flex-col gap-5">
              {/* Hero banner */}
              <div className="grain-overlay relative overflow-hidden rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/[0.06] via-background to-brand/[0.03] p-5">
                <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-brand/10 blur-2xl" />
                <div className="relative z-[2]">
                  <p className="text-sm font-semibold tracking-tight text-foreground">{t('project.hub.start.heroTitle')}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {t('project.hub.start.heroBody')}
                  </p>
                </div>
              </div>

              {/* Action cards */}
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setStep('create')}
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 text-left shadow-elevation-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-elevation-2"
                >
                  <div className="pointer-events-none absolute -right-4 -top-4 size-16 rounded-full bg-brand/5 transition-transform duration-300 group-hover:scale-150" />
                  <div className="relative mb-3 inline-flex rounded-xl bg-brand/[0.08] p-2.5 text-brand ring-1 ring-brand/10">
                    <Plus className="size-4" />
                  </div>
                  <p className="text-sm font-semibold tracking-tight">{t('project.hub.start.cardCreate.title')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('project.hub.start.cardCreate.description')}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('spreadsheet')}
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 text-left shadow-elevation-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-elevation-2"
                >
                  <div className="pointer-events-none absolute -right-4 -top-4 size-16 rounded-full bg-brand/5 transition-transform duration-300 group-hover:scale-150" />
                  <div className="relative mb-3 inline-flex rounded-xl bg-emerald-500/[0.08] p-2.5 text-emerald-700 ring-1 ring-emerald-500/10 dark:text-emerald-400">
                    <FileSpreadsheet className="size-4" />
                  </div>
                  <p className="text-sm font-semibold tracking-tight">{t('project.hub.start.cardSpreadsheet.title')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('project.hub.start.cardSpreadsheet.description')}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('import')}
                  className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 text-left shadow-elevation-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-elevation-2"
                >
                  <div className="pointer-events-none absolute -right-4 -top-4 size-16 rounded-full bg-brand/5 transition-transform duration-300 group-hover:scale-150" />
                  <div className="relative mb-3 inline-flex rounded-xl bg-violet-500/[0.08] p-2.5 text-violet-700 ring-1 ring-violet-500/10 dark:text-violet-400">
                    <Upload className="size-4" />
                  </div>
                  <p className="text-sm font-semibold tracking-tight">{t('project.hub.start.cardImport.title')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('project.hub.start.cardImport.description')}</p>
                </button>
              </div>

              {/* Existing projects */}
              <div className="rounded-xl border border-border/50 bg-muted/15 p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-tight">{t('project.hub.start.existingProjects')}</p>
                  <Badge variant="secondary" className="rounded-full border-brand/15 bg-brand/[0.06] font-mono text-[10px] text-brand">{sortedProjects.length}</Badge>
                </div>
                {sortedProjects.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {sortedProjects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="group flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 transition-all duration-200 hover:border-brand/20 hover:bg-brand/[0.04] hover:shadow-elevation-1"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center justify-between text-left"
                          onClick={() => void handleOpenProject(project.id)}
                          disabled={isBusy}
                        >
                          <span className="truncate text-sm font-medium">{project.name}</span>
                          <FolderOpen className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand" />
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          onClick={() => void handleDeleteProject(project.id, project.name)}
                          disabled={isBusy}
                          aria-label={t('project.hub.list.deleteAria', { name: project.name })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1.5 h-8 px-2 text-xs font-medium text-brand hover:bg-brand/[0.04] hover:text-brand"
                      onClick={() => setStep('open')}
                    >
                      {t('project.hub.start.viewAll')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('project.hub.start.noProjects')}</p>
                )}
              </div>

              {!canClose && (
                <div className="rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50/50 px-4 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-200">
                  {t('project.hub.start.warningBanner')}
                </div>
              )}
            </div>
          )}

          {step === 'create' && (
            <div className="flex flex-col gap-2.5">
              <Card className="border-border/50 shadow-elevation-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base tracking-tight">{t('project.hub.create.detailsTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('project.hub.create.detailsDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  <FormField label={t('project.field.name')} htmlFor="project-name" required error={createValidation.getError('name')}>
                    <Input
                      id="project-name"
                      value={form.name}
                      onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                      onBlur={() => createValidation.markTouched('name')}
                      placeholder="My_Modeling_Project"
                      className={createValidation.getError('name') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                    />
                  </FormField>
                  <FormField label={t('project.field.owner')} htmlFor="project-owner">
                    <Input
                      id="project-owner"
                      value={form.owner}
                      onChange={(event) => setForm((previous) => ({ ...previous, owner: event.target.value }))}
                      placeholder="BESSER User"
                    />
                  </FormField>
                  <FormField label={t('project.field.description')} htmlFor="project-description">
                    <Textarea
                      id="project-description"
                      value={form.description}
                      onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                      className="min-h-16"
                    />
                  </FormField>
                  {renderPerspectivePicker(createPerspectiveKey, setCreatePerspectiveKey, 'create')}
                  <Button onClick={() => void handleCreateProject()} disabled={isBusy || !createValidation.isValid} className="w-full gap-2 bg-brand text-brand-foreground shadow-elevation-1 transition-all hover:bg-brand-dark hover:shadow-elevation-2">
                    <Sparkles className="size-4" />
                    {t('project.hub.create.submit')}
                  </Button>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers3 className="size-3" />
                  {t('project.hub.create.tip')}
                </p>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium" onClick={() => setStep('start')}>
                  <ArrowLeft className="size-3.5" />
                  {t('project.hub.back')}
                </Button>
              </div>
            </div>
          )}

          {step === 'import' && (
            <div className="flex flex-col gap-5">
              <Card className="border-border/50 shadow-elevation-1">
                <CardHeader>
                  <CardTitle className="text-lg tracking-tight">{t('project.hub.import.cardTitle')}</CardTitle>
                  <CardDescription>{t('project.hub.import.cardDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div
                    role="button"
                    tabIndex={isBusy ? -1 : 0}
                    aria-disabled={isBusy}
                    aria-label={t('project.hub.import.dropAria')}
                    className={cn(
                      'grain-overlay relative overflow-hidden rounded-xl border-2 border-dashed bg-gradient-to-b from-brand/[0.03] to-muted/8 p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      isBusy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand/40 hover:bg-brand/[0.04]',
                      isDragging ? 'border-brand/50 bg-brand/[0.06]' : 'border-brand/20',
                    )}
                    onClick={() => { if (!isBusy) importFileInputRef.current?.click(); }}
                    onKeyDown={(e) => {
                      if (isBusy) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        importFileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={(e) => void handleImportDrop(e)}
                  >
                    <div className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 blur-2xl" />
                    <Upload className={cn('relative z-[2] mx-auto mb-3 size-8', isDragging ? 'text-brand/60' : 'text-brand/30')} />
                    <p className="relative z-[2] text-sm font-medium text-muted-foreground">{t('project.hub.import.dropPrompt')}</p>
                    <p className="relative z-[2] mt-1 text-xs text-muted-foreground/60">{t('project.hub.import.dropHint')}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium" onClick={() => setStep('start')}>
                  <ArrowLeft className="size-3.5" />
                  {t('project.hub.back')}
                </Button>
              </div>
            </div>
          )}

          {step === 'spreadsheet' && (
            <div className="flex flex-col gap-5">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium" onClick={() => setStep('start')}>
                <ArrowLeft className="size-3.5" />
                {t('project.hub.back')}
              </Button>

              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-border/50 shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-lg tracking-tight">{t('project.hub.spreadsheet.cardTitle')}</CardTitle>
                    <CardDescription>{t('project.hub.spreadsheet.cardDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FormField label={t('project.field.name')} htmlFor="spreadsheet-project-name" required error={spreadsheetValidation.getError('name')}>
                      <Input
                        id="spreadsheet-project-name"
                        value={spreadsheetForm.name}
                        onChange={(event) =>
                          setSpreadsheetForm((previous) => ({ ...previous, name: event.target.value }))
                        }
                        onBlur={() => spreadsheetValidation.markTouched('name')}
                        placeholder="My_Spreadsheet_Project"
                        className={spreadsheetValidation.getError('name') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                      />
                    </FormField>
                    <FormField label={t('project.field.owner')} htmlFor="spreadsheet-project-owner">
                      <Input
                        id="spreadsheet-project-owner"
                        value={spreadsheetForm.owner}
                        onChange={(event) =>
                          setSpreadsheetForm((previous) => ({ ...previous, owner: event.target.value }))
                        }
                        placeholder="BESSER User"
                      />
                    </FormField>
                    <FormField label={t('project.field.description')} htmlFor="spreadsheet-project-description">
                      <Textarea
                        id="spreadsheet-project-description"
                        value={spreadsheetForm.description}
                        onChange={(event) =>
                          setSpreadsheetForm((previous) => ({ ...previous, description: event.target.value }))
                        }
                        className="min-h-24"
                      />
                    </FormField>
                    {renderPerspectivePicker(spreadsheetPerspectiveKey, setSpreadsheetPerspectiveKey, 'spreadsheet')}

                    <div className="rounded-xl border-2 border-dashed border-border/50 bg-muted/10 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold tracking-tight">{t('project.hub.spreadsheet.sourceFiles')}</p>
                        <Badge variant="secondary" className="rounded-full font-mono text-[10px]">{spreadsheetFiles.length}</Badge>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-brand/20 text-brand shadow-elevation-1 transition-all hover:border-brand/30 hover:bg-brand/[0.04]"
                        onClick={() => spreadsheetFileInputRef.current?.click()}
                        disabled={isBusy}
                      >
                        <FileSpreadsheet className="size-4" />
                        {t('project.hub.spreadsheet.selectFiles')}
                      </Button>
                      {spreadsheetFiles.length > 0 && (
                        <div className="mt-3 flex flex-col gap-1.5">
                          {spreadsheetFiles.map((file) => (
                            <div
                              key={`${file.name}-${file.size}`}
                              className="flex items-center justify-between rounded-lg border border-border/40 bg-background/80 px-3 py-2 text-xs"
                            >
                              <span className="truncate font-medium">{file.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{readableFileSize(file.size)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button onClick={() => void handleStartFromSpreadsheet()} disabled={isBusy || !spreadsheetValidation.isValid} className="w-full gap-2 bg-brand text-brand-foreground shadow-elevation-1 transition-all hover:bg-brand-dark hover:shadow-elevation-2">
                      <Sparkles className="size-4" />
                      {t('project.hub.spreadsheet.submit')}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/50 shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-base tracking-tight">{t('project.hub.spreadsheet.howTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">1</span>
                      <p>{t('project.hub.spreadsheet.step1')}</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">2</span>
                      <p>{t('project.hub.spreadsheet.step2')}</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">3</span>
                      <p>{t('project.hub.spreadsheet.step3')}</p>
                    </div>
                    <p className="mt-1 rounded-lg bg-muted/30 px-3 py-2 font-mono text-[10px] tracking-wide">
                      {t('project.hub.spreadsheet.accepted')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 'open' && (
            <div className="flex flex-col gap-4">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setStep('start')}>
                <ArrowLeft className="mr-1.5 size-3.5" />
                {t('project.hub.back')}
              </Button>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-base font-semibold">{t('project.hub.open.allProjects')}</h3>
                <Badge variant="secondary">{sortedProjects.length}</Badge>
              </div>
              {renderProjectList()}
            </div>
          )}
        </div>
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
