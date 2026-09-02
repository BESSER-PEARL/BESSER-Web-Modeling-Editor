import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { settingsService, ClassNotation } from '@besser/wme';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Download, FolderKanban, KeyRound, Layers3, Monitor, Settings, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useProject } from '../../app/hooks/useProject';
import {
  ALL_DIAGRAM_TYPES,
  ProjectDiagram,
  SupportedDiagramType,
  diagramHasContent,
  isPerspectiveVisible,
} from '../../shared/types/project';
import { PERSPECTIVES, PerspectiveDefinition, isPresetActive } from '../../shared/perspectives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormField } from '@/components/ui/form-field';
import { validateProjectName } from '../../shared/utils/validation';
import { useFieldValidation } from '../../shared/hooks/useFieldValidation';
import { DIAGRAM_TYPE_BADGE } from '../../shared/constants/diagramTypeStyles';
import { useAppDispatch } from '../../app/store/hooks';
import { applyPerspectivePresetThunk, setPerspectiveEnabledThunk } from '../../app/store/workspaceSlice';
import { LlmKeyDialog } from '../../shared/components/byok/LlmKeyDialog';
import { readLlmKey } from '../../shared/services/llmKeyStorage';
import { setApiKeyPresent } from '../spec-driven/state/specDrivenSlice';

export const ProjectSettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [showInstancedObjects, setShowInstancedObjects] = useState(false);
  const [showAssociationNames, setShowAssociationNames] = useState(false);
  const [usePropertiesPanel, setUsePropertiesPanel] = useState(false);
  const [classNotation, setClassNotation] = useState<ClassNotation>('UML');
  // Unified LLM BYOK key (shared by the assistant + Spec-Driven generator).
  const [llmKeyOpen, setLlmKeyOpen] = useState(false);
  const [llmKeyInfo, setLlmKeyInfo] = useState(() => readLlmKey());

  const { currentProject, loading, error, updateProject, exportProject } = useProject();
  const dispatch = useAppDispatch();

  const perspectives = currentProject?.settings?.perspectives;
  const enabledPerspectiveCount = useMemo(
    () => ALL_DIAGRAM_TYPES.filter((t) => isPerspectiveVisible(perspectives, t)).length,
    [perspectives],
  );

  const handlePerspectiveToggle = useCallback(
    (type: SupportedDiagramType, enabled: boolean) => {
      dispatch(setPerspectiveEnabledThunk({ type, enabled }))
        .unwrap()
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : t('project.settings.toasts.updatePerspectiveFailed'));
        });
    },
    [dispatch, t],
  );

  const handleApplyPreset = useCallback(
    (preset: PerspectiveDefinition) => {
      dispatch(applyPerspectivePresetThunk({ diagrams: preset.diagrams }))
        .unwrap()
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : t('project.settings.toasts.applyPresetFailed'));
        });
    },
    [dispatch, t],
  );

  useEffect(() => {
    setShowInstancedObjects(settingsService.shouldShowInstancedObjects());
    setShowAssociationNames(settingsService.shouldShowAssociationNames());
    setUsePropertiesPanel(settingsService.shouldUsePropertiesPanel());
    setClassNotation(settingsService.getClassNotation());
  }, []);

  const diagrams = useMemo(() => {
    if (!currentProject) return [];
    return Object.entries(currentProject.diagrams).flatMap(([type, diagramArr]) =>
      (diagramArr as ProjectDiagram[])
        .filter((diagram) => diagramHasContent(diagram))
        .map((diagram, index) => ({
          type: type as SupportedDiagramType,
          diagram,
          index,
        })),
    );
  }, [currentProject]);

  const settingsValidators = useMemo(() => ({
    name: () => validateProjectName(currentProject?.name ?? ''),
  }), [currentProject?.name]);
  const settingsValidation = useFieldValidation(settingsValidators);

  const handleProjectField = useCallback((field: 'name' | 'description' | 'owner', value: string) => {
    if (!currentProject) return;
    updateProject({ [field]: value });
  }, [currentProject, updateProject]);

  const handleExportProject = async () => {
    if (!currentProject) return;

    try {
      setIsExporting(true);

      const graphicalEditor = (window as any).editor;
      if (graphicalEditor && currentProject.currentDiagramType === 'GUINoCodeDiagram') {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('GrapesJS save timeout')), 5000);
          graphicalEditor.store(() => {
            clearTimeout(timeout);
            setTimeout(resolve, 250);
          });
        });
      }

      await exportProject(currentProject.id, true);
      toast.success(t('project.settings.toasts.exported'));
    } catch (exportError) {
      toast.error(t('project.settings.toasts.exportFailed', { error: exportError instanceof Error ? exportError.message : t('project.settings.unknownError') }));
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{t('project.settings.loadingProject')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{t('project.settings.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Page header */}
      <div className="border-b border-border/40 px-6 py-5 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
              <Settings className="size-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{t('project.settings.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('project.settings.subtitle')}</p>
            </div>
          </div>
          <Button onClick={handleExportProject} disabled={isExporting} variant="outline" className="gap-2">
            <Download className="size-4" />
            {isExporting ? t('project.settings.exporting') : t('project.settings.exportProject')}
          </Button>
        </div>
      </div>

      {/* Page body — two-column layout */}
      <div className="px-6 py-8 sm:px-10">
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Left column */}
          <div className="flex flex-col gap-6">
            {/* General */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="size-4 text-brand" />
                  <CardTitle className="text-base">{t('project.settings.general.title')}</CardTitle>
                </div>
                <CardDescription>{t('project.settings.general.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FormField label={t('project.settings.general.projectName')} htmlFor="settings-name" required error={settingsValidation.getError('name')}>
                  <Input
                    id="settings-name"
                    value={currentProject.name}
                    onChange={(event) => handleProjectField('name', event.target.value)}
                    onBlur={() => settingsValidation.markTouched('name')}
                    className={settingsValidation.getError('name') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                  />
                </FormField>
                <FormField label={t('project.field.owner')} htmlFor="settings-owner">
                  <Input id="settings-owner" value={currentProject.owner} onChange={(event) => handleProjectField('owner', event.target.value)} />
                </FormField>
                <FormField label={t('project.field.description')} htmlFor="settings-description">
                  <Textarea
                    id="settings-description"
                    value={currentProject.description}
                    onChange={(event) => handleProjectField('description', event.target.value)}
                    className="min-h-24"
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('project.settings.general.created')}</p>
                    <p className="mt-1 text-sm">{new Date(currentProject.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('project.settings.general.activeEditor')}</p>
                    <p className="mt-1 text-sm">{currentProject.currentDiagramType.replace('Diagram', '')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Display */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Monitor className="size-4 text-brand" />
                  <CardTitle className="text-base">{t('project.settings.display.title')}</CardTitle>
                </div>
                <CardDescription>{t('project.settings.display.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{t('project.settings.display.showInstancedObjects')}</p>
                    <p className="text-xs text-muted-foreground">{t('project.settings.display.showInstancedObjectsDesc')}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={showInstancedObjects}
                    onChange={(event) => {
                      setShowInstancedObjects(event.target.checked);
                      settingsService.updateSetting('showInstancedObjects', event.target.checked);
                      // toast.success(`Instanced objects ${event.target.checked ? 'enabled' : 'disabled'}.`);
                    }}
                  />
                </label>
                <Separator />
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{t('project.settings.display.showAssociationNames')}</p>
                    <p className="text-xs text-muted-foreground">{t('project.settings.display.showAssociationNamesDesc')}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={showAssociationNames}
                    onChange={(event) => {
                      setShowAssociationNames(event.target.checked);
                      settingsService.updateSetting('showAssociationNames', event.target.checked);
                      // toast.success(`Association names ${event.target.checked ? 'enabled' : 'disabled'}.`);
                    }}
                  />
                </label>
                <Separator />
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{t('project.settings.display.propertiesPanel')}</p>
                    <p className="text-xs text-muted-foreground">{t('project.settings.display.propertiesPanelDesc')}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={usePropertiesPanel}
                    onChange={(event) => {
                      setUsePropertiesPanel(event.target.checked);
                      settingsService.updateSetting('usePropertiesPanel', event.target.checked);
                    }}
                  />
                </label>
                <Separator />
                <div className="flex items-center justify-between gap-4 rounded-lg px-1 py-3">
                  <div>
                    <p className="text-sm font-medium">{t('project.settings.display.classNotation')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('project.settings.display.classNotationDesc')}
                    </p>
                  </div>
                  <RadioGroup
                    aria-label={t('project.settings.display.classNotation')}
                    value={classNotation}
                    onValueChange={(value) => {
                      const next = value as ClassNotation;
                      setClassNotation(next);
                      settingsService.updateSetting('classNotation', next);
                    }}
                  >
                    {(['UML', 'ER'] as const).map((value) => (
                      <RadioGroupItem
                        key={value}
                        value={value}
                        data-testid={`class-notation-${value.toLowerCase()}`}
                      >
                        {value}
                      </RadioGroupItem>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* AI / LLM API Key — the single place to set the BYOK key used by
                BOTH the modeling assistant and the Spec-Driven generator. */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-brand" />
                  <CardTitle className="text-base">AI / LLM API Key</CardTitle>
                </div>
                <CardDescription>
                  Use your own Anthropic, OpenAI, or Mistral key. Entered once here, it powers both the
                  modeling assistant and the Spec-Driven generator. Stored only in this browser tab, never
                  on our servers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3">
                  <div className="min-w-0">
                    {llmKeyInfo ? (
                      <>
                        <p className="truncate text-sm font-medium">
                          Key set · {llmKeyInfo.provider}
                          {llmKeyInfo.model ? ` · ${llmKeyInfo.model}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">Applies to the assistant and generator</p>
                      </>
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium">No key set</p>
                        <p className="text-xs text-muted-foreground">Using the shared server key + rate limits</p>
                      </>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLlmKeyOpen(true)}>
                    <KeyRound className="size-3.5" />
                    {llmKeyInfo ? 'Change key' : 'Set API key'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column — Diagrams + Modeling Perspectives */}
          <div className="flex flex-col gap-6">
            <Card className="h-fit">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Layers3 className="size-4 text-brand" />
                  <CardTitle className="text-base">{t('project.settings.diagrams.title')}</CardTitle>
                </div>
                <CardDescription>
                  {diagrams.length > 0
                    ? t('project.settings.diagrams.countWithContent', { count: diagrams.length })
                    : t('project.settings.diagrams.noneWithContent')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {diagrams.map(({ type, diagram, index }) => (
                    <div key={`${type}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{diagram.title}</p>
                        <p className="text-xs text-muted-foreground">{t('project.settings.diagrams.updated', { date: new Date(diagram.lastUpdate).toLocaleString() })}</p>
                      </div>
                      <Badge className={DIAGRAM_TYPE_BADGE[type]}>{type.replace('Diagram', '')}</Badge>
                    </div>
                  ))}
                  {diagrams.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t('project.settings.diagrams.empty')}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Modeling Perspectives — preset row + per-diagram toggles */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-brand" />
                  <CardTitle className="text-base">{t('project.settings.perspectives.title')}</CardTitle>
                </div>
                <CardDescription>
                  {t('project.settings.perspectives.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Preset row */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="size-3.5" />
                    <span>{t('project.settings.perspectives.quickPresets')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PERSPECTIVES.map((preset) => {
                      const active = isPresetActive(preset, perspectives);
                      return (
                        <Button
                          key={preset.key}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          title={t(`project.settings.perspectives.presets.${preset.key}.description`)}
                          onClick={() => handleApplyPreset(preset)}
                          data-testid={`perspective-preset-${preset.key}`}
                          aria-pressed={active}
                        >
                          {t(`project.settings.perspectives.presets.${preset.key}.label`)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Per-diagram toggles */}
                <div className="flex flex-col gap-1">
                  {ALL_DIAGRAM_TYPES.map((type, index) => {
                    const checked = isPerspectiveVisible(perspectives, type);
                    const isLastEnabled = checked && enabledPerspectiveCount === 1;
                    const labelId = `perspective-toggle-${type}`;
                    return (
                      <React.Fragment key={type}>
                        {index > 0 && <Separator />}
                        <label
                          htmlFor={labelId}
                          className={`flex items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors ${
                            isLastEnabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/30'
                          }`}
                          title={isLastEnabled ? t('project.settings.perspectives.lastEnabledTitle') : undefined}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{t(`diagramTypes.${type}`)}</p>
                              <Badge className={DIAGRAM_TYPE_BADGE[type]}>
                                {type.replace('Diagram', '')}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t(`project.settings.perspectives.diagrams.${type}`)}
                            </p>
                          </div>
                          <input
                            id={labelId}
                            type="checkbox"
                            className="size-4 accent-brand"
                            checked={checked}
                            disabled={isLastEnabled}
                            aria-label={t('project.settings.perspectives.toggleAria', { label: t(`diagramTypes.${type}`) })}
                            data-testid={`perspective-toggle-${type}`}
                            onChange={(event) =>
                              handlePerspectiveToggle(type, event.target.checked)
                            }
                          />
                        </label>
                      </React.Fragment>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      <LlmKeyDialog
        open={llmKeyOpen}
        onOpenChange={setLlmKeyOpen}
        onSaved={() => {
          dispatch(setApiKeyPresent(true));
          setLlmKeyInfo(readLlmKey());
        }}
        onRemoved={() => {
          dispatch(setApiKeyPresent(false));
          setLlmKeyInfo(readLlmKey());
        }}
      />
    </div>
  );
};
