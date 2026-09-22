import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormField } from '@/components/ui/form-field';
import type { WebAppVersionMode } from '../../../shared/utils/buildWebAppVersions';
import type { JSONSchemaConfig, QiskitConfig, SQLAlchemyConfig, SQLConfig, SupabaseConfig } from '../hooks/useGenerateCode';
import type { ConfigDialog } from '../generator-dialog-config';
import { SHOW_FULL_AGENT_CONFIGURATION } from '../../../shared/constants/constant';
import type { StoredAgentConfiguration, StoredAgentProfileConfigurationMapping } from '../../../shared/services/storage/local-storage-types';
import {
  DEFAULT_AGENT_RUNTIME_CONFIG,
  normalizeAgentRuntimeConfig,
  type AgentRuntimeConfig,
} from '../../../shared/services/storage/local-storage-repository';
import type { AgentGenerationMode, AgentGenerationVariantOption, WebAppChecklistInfo, WebAppChecklistDiagramInfo } from '../useGeneratorExecution';
import { validateProjectName, validateNumberRange } from '../../../shared/utils/validation';
import { useFieldValidation } from '../../../shared/hooks/useFieldValidation';
import { useProject } from '../../../app/hooks/useProject';
import { getActiveDiagram } from '../../../shared/types/project';

/**
 * Props for the <GeneratorConfigDialogs /> component.
 *
 * This component renders one <Dialog /> per generator (Django, SQL, SQLAlchemy,
 * JSON Schema, Agent, Qiskit). Only one dialog is visible at a time, controlled
 * by `configDialog`.
 *
 * State and callbacks are provided by the `useGeneratorExecution` hook via the
 * `GeneratorConfigState` interface. The parent simply spreads the config bag:
 *
 *   <GeneratorConfigDialogs {...configState} isLocalEnvironment={…} />
 */
interface GeneratorConfigDialogsProps {
  // ── Dialog control ───────────────────────────────────────────────────────
  /** Which config dialog is currently visible ('none' when closed). */
  configDialog: ConfigDialog;
  /** Open or close a config dialog by key. */
  setConfigDialog: (dialog: ConfigDialog) => void;
  /** True when running against localhost — enables the Django "Deploy" button. */
  isLocalEnvironment: boolean;

  // ── Django ───────────────────────────────────────────────────────────────
  djangoProjectName: string;
  djangoAppName: string;
  useDocker: boolean;

  // ── SQL ──────────────────────────────────────────────────────────────────
  sqlDialect: SQLConfig['dialect'];

  // ── Supabase ─────────────────────────────────────────────────────────────
  supabaseUserRoot: string;

  // ── SQLAlchemy ───────────────────────────────────────────────────────────
  sqlAlchemyDbms: SQLAlchemyConfig['dbms'];

  // ── JSON Schema ──────────────────────────────────────────────────────────
  jsonSchemaMode: JSONSchemaConfig['mode'];

  // ── Agent ────────────────────────────────────────────────────────────────
  /** Source language for the agent (e.g. 'english'). 'none' = not set. */
  sourceLanguage: string;
  /** Language currently picked in the dropdown but not yet added. */
  pendingAgentLanguage: string;
  /** Languages the agent will be translated to. */
  selectedAgentLanguages: string[];
  /** Whether at least one saved agent configuration preset exists. */
  hasSavedAgentConfiguration: boolean;
  /** Advanced mode selector (visible only when SHOW_FULL_AGENT_CONFIGURATION). */
  agentMode: 'original' | 'configuration' | 'personalization';
  /** Stored agent configuration presets. */
  storedAgentConfigurations: StoredAgentConfiguration[];
  /** Profile → configuration mappings for personalization mode. */
  storedAgentMappings: Array<StoredAgentProfileConfigurationMapping & { userProfileLabel: string; agentConfigurationLabel: string }>;
  /** IDs of the currently selected stored configurations / mappings. */
  selectedStoredAgentConfigIds: string[];
  /** Personalized variants available in the active Agent tab. */
  agentVariantOptions: AgentGenerationVariantOption[];
  /** Selected personalized variant to generate. Empty means base/original model. */
  selectedAgentVariantId: string;
  /** Generation strategy for variants: one selected variant or personalization-all. */
  agentGenerationMode: AgentGenerationMode;

  // ── Qiskit ───────────────────────────────────────────────────────────────
  qiskitBackend: QiskitConfig['backend'];
  qiskitShots: number;

  // ── Field change handlers ────────────────────────────────────────────────
  onDjangoProjectNameChange: (value: string) => void;
  onDjangoAppNameChange: (value: string) => void;
  onUseDockerChange: (value: boolean) => void;
  onSqlDialectChange: (value: SQLConfig['dialect']) => void;
  onSupabaseUserRootChange: (value: string) => void;
  onSqlAlchemyDbmsChange: (value: SQLAlchemyConfig['dbms']) => void;
  onJsonSchemaModeChange: (value: JSONSchemaConfig['mode']) => void;
  onSourceLanguageChange: (value: string) => void;
  onPendingAgentLanguageChange: (value: string) => void;
  onSelectedAgentLanguagesChange: (value: string[]) => void;
  onQiskitBackendChange: (value: QiskitConfig['backend']) => void;
  onQiskitShotsChange: (value: number) => void;
  onAgentModeChange: (value: 'original' | 'configuration' | 'personalization') => void;
  onStoredAgentConfigToggle: (id: string) => void;
  onSelectedAgentVariantIdChange: (value: string) => void;
  onAgentGenerationModeChange: (value: AgentGenerationMode) => void;

  // ── Web App checklist ──────────────────────────────────────────────────
  /** Pre-generation checklist info for the web_app generator. */
  webAppChecklist: WebAppChecklistInfo | null;
  /** Which version(s) to generate when the GUI has page variants. */
  webAppVersionMode: WebAppVersionMode;
  /** Selected profile id when webAppVersionMode === 'profile'. */
  webAppSelectedProfileId: string;
  onWebAppVersionModeChange: (value: WebAppVersionMode) => void;
  onWebAppSelectedProfileIdChange: (value: string) => void;

  // ── Execution callbacks (one per generator) ──────────────────────────────
  /** Validate inputs, call the backend, and close the dialog on success. */
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
  onSupabaseGenerate: () => void;
  onSqlAlchemyGenerate: () => void;
  onJsonSchemaGenerate: () => void;
  onAgentGenerate: () => void;
  onQiskitGenerate: () => void;
  onWebAppGenerate: () => void;
}

const closeDialog = (setConfigDialog: (dialog: ConfigDialog) => void): void => {
  setConfigDialog('none');
};

export const GeneratorConfigDialogs: React.FC<GeneratorConfigDialogsProps> = ({
  configDialog,
  setConfigDialog,
  isLocalEnvironment,
  djangoProjectName,
  djangoAppName,
  useDocker,
  sqlDialect,
  supabaseUserRoot,
  sqlAlchemyDbms,
  jsonSchemaMode,
  sourceLanguage,
  pendingAgentLanguage,
  selectedAgentLanguages,
  qiskitBackend,
  qiskitShots,
  hasSavedAgentConfiguration,
  agentMode,
  storedAgentConfigurations,
  storedAgentMappings,
  selectedStoredAgentConfigIds,
  agentVariantOptions,
  selectedAgentVariantId,
  agentGenerationMode,
  onDjangoProjectNameChange,
  onDjangoAppNameChange,
  onUseDockerChange,
  onSqlDialectChange,
  onSupabaseUserRootChange,
  onSqlAlchemyDbmsChange,
  onJsonSchemaModeChange,
  onSourceLanguageChange,
  onPendingAgentLanguageChange,
  onSelectedAgentLanguagesChange,
  onQiskitBackendChange,
  onQiskitShotsChange,
  onAgentModeChange,
  onStoredAgentConfigToggle,
  onSelectedAgentVariantIdChange,
  onAgentGenerationModeChange,
  webAppChecklist,
  webAppVersionMode,
  webAppSelectedProfileId,
  onWebAppVersionModeChange,
  onWebAppSelectedProfileIdChange,
  onDjangoGenerate,
  onDjangoDeploy,
  onSqlGenerate,
  onSupabaseGenerate,
  onSqlAlchemyGenerate,
  onJsonSchemaGenerate,
  onAgentGenerate,
  onQiskitGenerate,
  onWebAppGenerate,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ── Django inline validation ──────────────────────────────────────────
  const djangoValidators = useMemo(() => ({
    projectName: () => validateProjectName(djangoProjectName),
    appName: () => validateProjectName(djangoAppName),
  }), [djangoProjectName, djangoAppName]);
  const djangoValidation = useFieldValidation(djangoValidators);

  // ── Qiskit inline validation ──────────────────────────────────────────
  const qiskitValidators = useMemo(() => ({
    shots: () => validateNumberRange(qiskitShots, 1, 100000, t('generation.qiskit.shotsLabel')),
  }), [qiskitShots, t]);
  const qiskitValidation = useFieldValidation(qiskitValidators);

  // ── Agent runtime config preview (read-only snapshot from active agent diagram) ─
  // Single source of truth: AgentDiagram.config. Falls back to hardcoded
  // defaults when the project has no agent diagram (edge case — the agent
  // generator dialog should normally only be reachable when one exists).
  const { currentProject } = useProject();
  const agentSystemConfig = useMemo<AgentRuntimeConfig | null>(() => {
    if (configDialog !== 'agent') return null;
    const activeAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
    const diagramConfig = (activeAgentDiagram?.config ?? null) as Record<string, any> | null;
    if (!diagramConfig) {
      return { ...DEFAULT_AGENT_RUNTIME_CONFIG };
    }
    const llmBlock = typeof diagramConfig.llm === 'object' && diagramConfig.llm !== null
      ? (diagramConfig.llm as Record<string, any>)
      : null;
    return normalizeAgentRuntimeConfig({
      agentPlatform: typeof diagramConfig.agentPlatform === 'string' ? diagramConfig.agentPlatform : undefined,
      agentPlatformUseStreamlit: typeof diagramConfig.agentPlatformUseStreamlit === 'boolean' ? diagramConfig.agentPlatformUseStreamlit : undefined,
      intentRecognitionTechnology: diagramConfig.intentRecognitionTechnology,
      agentLlmProvider: llmBlock?.provider,
      agentLlmModel: typeof llmBlock?.model === 'string' ? llmBlock.model : undefined,
      agentCustomLlmModel: undefined,
      agentLlmName:
        typeof diagramConfig.agentLlmName === 'string'
          ? diagramConfig.agentLlmName
          : (typeof llmBlock?.name === 'string' ? llmBlock.name : undefined),
    });
  }, [configDialog, currentProject]);
  const agentPlatformLabel = useMemo(() => {
    switch (agentSystemConfig?.agentPlatform) {
      case 'websocket':
        return agentSystemConfig.agentPlatformUseStreamlit
          ? t('generation.agent.platformWebSocketStreamlit')
          : t('generation.agent.platformWebSocket');
      case 'streamlit':
        return t('generation.agent.platformStreamlit');
      case 'telegram':
        return t('generation.agent.platformTelegram');
      default:
        return agentSystemConfig?.agentPlatform ?? '—';
    }
  }, [agentSystemConfig, t]);
  return (
    <>
      <Dialog
        open={configDialog === 'django'}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog(setConfigDialog);
            djangoValidation.resetTouched();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generation.django.title')}</DialogTitle>
            <DialogDescription>{t('generation.django.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <FormField label={t('generation.django.projectName')} htmlFor="django-project-name" required error={djangoValidation.getError('projectName')}>
              <Input
                id="django-project-name"
                value={djangoProjectName}
                onChange={(event) => onDjangoProjectNameChange(event.target.value.replace(/\s/g, '_'))}
                onBlur={() => djangoValidation.markTouched('projectName')}
                placeholder="my_django_project"
                className={djangoValidation.getError('projectName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
              />
            </FormField>
            <FormField label={t('generation.django.appName')} htmlFor="django-app-name" required error={djangoValidation.getError('appName')}>
              <Input
                id="django-app-name"
                value={djangoAppName}
                onChange={(event) => onDjangoAppNameChange(event.target.value.replace(/\s/g, '_'))}
                onBlur={() => djangoValidation.markTouched('appName')}
                placeholder="my_app"
                className={djangoValidation.getError('appName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
              />
            </FormField>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
              {t('generation.django.includeDocker')}
              <input type="checkbox" checked={useDocker} onChange={(event) => onUseDockerChange(event.target.checked)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onDjangoGenerate} disabled={!djangoValidation.isValid}>{t('generation.generate')}</Button>
            {isLocalEnvironment && (
              <Button variant="secondary" onClick={onDjangoDeploy} disabled={!djangoValidation.isValid}>
                {t('generation.deploy')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'sql'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generation.sql.title')}</DialogTitle>
            <DialogDescription>{t('generation.sql.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>{t('generation.sql.dialect')}</Label>
            <Select value={sqlDialect} onValueChange={(value) => onSqlDialectChange(value as SQLConfig['dialect'])}>
              <SelectTrigger>
                <SelectValue placeholder={t('generation.sql.selectDialect')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mssql">MS SQL Server</SelectItem>
                <SelectItem value="mariadb">MariaDB</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSqlGenerate}>{t('generation.generate')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'supabase'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generation.supabase.title')}</DialogTitle>
            <DialogDescription>
              {t('generation.supabase.descriptionBefore')} <code>auth.users</code> {t('generation.supabase.descriptionAfter')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supabase-user-root">{t('generation.supabase.userRootLabel')}</Label>
            <Input
              id="supabase-user-root"
              value={supabaseUserRoot}
              onChange={(event) => onSupabaseUserRootChange(event.target.value)}
              placeholder="User"
            />
            <p className="text-xs text-muted-foreground">
              {t('generation.supabase.hintBefore')} <code>auth.users</code> {t('generation.supabase.hintMiddle')} <code>User</code>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSupabaseGenerate}>{t('generation.generate')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'sqlalchemy'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generation.sqlAlchemy.title')}</DialogTitle>
            <DialogDescription>{t('generation.sqlAlchemy.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>{t('generation.sqlAlchemy.dbms')}</Label>
            <Select
              value={sqlAlchemyDbms}
              onValueChange={(value) => onSqlAlchemyDbmsChange(value as SQLAlchemyConfig['dbms'])}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('generation.sqlAlchemy.selectDbms')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mssql">MS SQL Server</SelectItem>
                <SelectItem value="mariadb">MariaDB</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onSqlAlchemyGenerate}>{t('generation.generate')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'jsonschema'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generation.jsonSchema.title')}</DialogTitle>
            <DialogDescription>{t('generation.jsonSchema.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>{t('generation.jsonSchema.mode')}</Label>
            <Select value={jsonSchemaMode} onValueChange={(value) => onJsonSchemaModeChange(value as JSONSchemaConfig['mode'])}>
              <SelectTrigger>
                <SelectValue placeholder={t('generation.jsonSchema.selectMode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">{t('generation.jsonSchema.regular')}</SelectItem>
                <SelectItem value="smart_data">Smart Data Models</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onJsonSchemaGenerate}>{t('generation.generate')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'agent'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('generation.agent.title')}</DialogTitle>
            <DialogDescription>{t('generation.agent.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {!hasSavedAgentConfiguration && (
              <div className="p-3 border rounded bg-muted/30">
                <div className="text-sm text-muted-foreground mb-2">
                  {t('generation.agent.noSavedConfig')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closeDialog(setConfigDialog);
                    navigate('/agent-config');
                  }}
                >
                  {t('generation.agent.configureTechnologies')}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>{t('generation.agent.sourceLanguage')}</Label>
              <Select value={sourceLanguage} onValueChange={onSourceLanguageChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('generation.agent.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('generation.agent.selectLanguage')}</SelectItem>
                  <SelectItem value="english">{t('generation.agent.languages.english')}</SelectItem>
                  <SelectItem value="french">{t('generation.agent.languages.french')}</SelectItem>
                  <SelectItem value="german">{t('generation.agent.languages.german')}</SelectItem>
                  <SelectItem value="luxembourgish">{t('generation.agent.languages.luxembourgish')}</SelectItem>
                  <SelectItem value="portuguese">{t('generation.agent.languages.portuguese')}</SelectItem>
                  <SelectItem value="spanish">{t('generation.agent.languages.spanish')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('generation.agent.addSpokenLanguage')}</Label>
              <div className="flex gap-2">
                <Select value={pendingAgentLanguage} onValueChange={onPendingAgentLanguageChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('generation.agent.selectLanguage')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('generation.agent.selectLanguage')}</SelectItem>
                    <SelectItem value="english">{t('generation.agent.languages.english')}</SelectItem>
                    <SelectItem value="french">{t('generation.agent.languages.french')}</SelectItem>
                    <SelectItem value="german">{t('generation.agent.languages.german')}</SelectItem>
                    <SelectItem value="luxembourgish">{t('generation.agent.languages.luxembourgish')}</SelectItem>
                    <SelectItem value="portuguese">{t('generation.agent.languages.portuguese')}</SelectItem>
                    <SelectItem value="spanish">{t('generation.agent.languages.spanish')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (pendingAgentLanguage === 'none' || selectedAgentLanguages.includes(pendingAgentLanguage)) {
                      return;
                    }
                    onSelectedAgentLanguagesChange([...selectedAgentLanguages, pendingAgentLanguage]);
                    onPendingAgentLanguageChange('none');
                  }}
                >
                  {t('generation.agent.addLanguage')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('generation.agent.translatedToAll')}
              </p>
              <div className="text-sm text-amber-600 flex items-center gap-1">
                <span role="img" aria-label={t('generation.agent.warningAriaLabel')}>⚠️</span>
                <span>{t('generation.agent.moreLanguagesWarning')}</span>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t('generation.agent.systemConfiguration')}</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => {
                    closeDialog(setConfigDialog);
                    navigate('/agent-config');
                  }}
                >
                  {t('generation.agent.editInAgentConfig')}
                </Button>
              </div>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                <div className="flex justify-between gap-2 md:block">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('generation.agent.platform')}</dt>
                  <dd>{agentPlatformLabel}</dd>
                </div>
                <div className="flex justify-between gap-2 md:block">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('generation.agent.intentRecognition')}</dt>
                  <dd>{agentSystemConfig?.intentRecognitionTechnology === 'classical' ? t('generation.agent.classical') : t('generation.agent.llmBased')}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                {t('generation.agent.systemConfigHint')}
              </p>
            </div>

            {agentVariantOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>{t('generation.agent.personalizationStrategy')}</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="variant-mode-none"
                      name="agentVariantMode"
                      checked={agentGenerationMode === 'none'}
                      onChange={() => onAgentGenerationModeChange('none')}
                      className="size-4"
                    />
                    <Label htmlFor="variant-mode-none" className="text-sm font-normal">{t('generation.agent.none')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="variant-mode-personalization"
                      name="agentVariantMode"
                      checked={agentGenerationMode === 'personalization'}
                      onChange={() => onAgentGenerationModeChange('personalization')}
                      className="size-4"
                    />
                    <Label htmlFor="variant-mode-personalization" className="text-sm font-normal">{t('generation.agent.personalizationAll')}</Label>
                  </div>
                </div>

                {agentGenerationMode === 'personalization' ? (
                  <p className="text-xs text-muted-foreground">
                    {t('generation.agent.personalizationAllHint')}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('generation.agent.personalizationNoneHint')}
                  </p>
                )}
              </div>
            )}

            {SHOW_FULL_AGENT_CONFIGURATION && (
              <div className="flex flex-col gap-1.5">
                <Label>{t('generation.agent.mode')}</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-original"
                      name="agentMode"
                      checked={agentMode === 'original'}
                      onChange={() => onAgentModeChange('original')}
                      className="size-4"
                    />
                    <Label htmlFor="mode-original" className="text-sm font-normal">{t('generation.agent.modeOriginal')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-config"
                      name="agentMode"
                      checked={agentMode === 'configuration'}
                      onChange={() => onAgentModeChange('configuration')}
                      className="size-4"
                    />
                    <Label htmlFor="mode-config" className="text-sm font-normal">{t('generation.agent.modeConfiguration')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="mode-personalization"
                      name="agentMode"
                      checked={agentMode === 'personalization'}
                      onChange={() => onAgentModeChange('personalization')}
                      className="size-4"
                    />
                    <Label htmlFor="mode-personalization" className="text-sm font-normal">{t('generation.agent.modePersonalization')}</Label>
                  </div>
                </div>
              </div>
            )}

            {SHOW_FULL_AGENT_CONFIGURATION && (agentMode === 'configuration' || agentMode === 'personalization') && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  {agentMode === 'personalization'
                    ? t('generation.agent.selectMappings')
                    : t('generation.agent.selectStoredConfigs')}
                </Label>
                {agentMode === 'personalization' ? (
                  storedAgentMappings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('generation.agent.noMappingsFound')}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {storedAgentMappings.map((mapping) => (
                        <div key={mapping.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`storedAgentMapping-${mapping.id}`}
                            checked={selectedStoredAgentConfigIds.includes(mapping.agentConfigurationId)}
                            onChange={() => onStoredAgentConfigToggle(mapping.agentConfigurationId)}
                            className="size-4"
                          />
                          <Label htmlFor={`storedAgentMapping-${mapping.id}`} className="text-sm font-normal">
                            {mapping.userProfileLabel} → {mapping.agentConfigurationLabel} ({new Date(mapping.savedAt).toLocaleString()})
                          </Label>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        {t('generation.agent.mappingsListHint')}
                      </p>
                    </div>
                  )
                ) : (
                  storedAgentConfigurations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('generation.agent.noStoredConfigsFound')}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {storedAgentConfigurations.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`storedAgentConfig-${entry.id}`}
                            checked={selectedStoredAgentConfigIds.includes(entry.id)}
                            onChange={() => onStoredAgentConfigToggle(entry.id)}
                            className="size-4"
                          />
                          <Label htmlFor={`storedAgentConfig-${entry.id}`} className="text-sm font-normal">
                            {entry.name} ({new Date(entry.savedAt).toLocaleString()})
                          </Label>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        {t('generation.agent.storedConfigsListHint')}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            {selectedAgentLanguages.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>{t('generation.agent.selectedLanguages')}</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedAgentLanguages.map((language) => {
                    const languageLabel = t(`generation.agent.languages.${language}`, {
                      defaultValue: language.charAt(0).toUpperCase() + language.slice(1),
                    });
                    return (
                      <button
                        key={language}
                        type="button"
                        className="rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs hover:bg-muted/60"
                        onClick={() =>
                          onSelectedAgentLanguagesChange(selectedAgentLanguages.filter((entry) => entry !== language))
                        }
                        aria-label={t('generation.agent.removeLanguage', { language: languageLabel })}
                      >
                        {languageLabel} ✕
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onAgentGenerate}>{t('generation.generate')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={configDialog === 'qiskit'}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog(setConfigDialog);
            qiskitValidation.resetTouched();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generation.qiskit.title')}</DialogTitle>
            <DialogDescription>{t('generation.qiskit.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t('generation.qiskit.executionBackend')}</Label>
              <Select value={qiskitBackend} onValueChange={(value) => onQiskitBackendChange(value as QiskitConfig['backend'])}>
                <SelectTrigger>
                  <SelectValue placeholder={t('generation.qiskit.selectBackend')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aer_simulator">{t('generation.qiskit.backendAerSimulator')}</SelectItem>
                  <SelectItem value="fake_backend">{t('generation.qiskit.backendMockSimulation')}</SelectItem>
                  <SelectItem value="ibm_quantum">{t('generation.qiskit.backendIbmQuantum')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormField label={t('generation.qiskit.numberOfShots')} htmlFor="qiskit-shots" required error={qiskitValidation.getError('shots')}>
              <Input
                id="qiskit-shots"
                type="number"
                min={1}
                max={100000}
                value={qiskitShots}
                onChange={(event) => onQiskitShotsChange(Math.max(1, Number(event.target.value || 1024)))}
                onBlur={() => qiskitValidation.markTouched('shots')}
                className={qiskitValidation.getError('shots') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onQiskitGenerate} disabled={!qiskitValidation.isValid}>{t('generation.generate')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'web_app_checklist'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('generation.webApp.title')}</DialogTitle>
            <DialogDescription>{t('generation.webApp.description')}</DialogDescription>
          </DialogHeader>
          {webAppChecklist ? (
            <div className="flex flex-col gap-4">
              {/* Required diagrams */}
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">{t('generation.webApp.required')}</p>
                <div className="flex flex-col gap-2">
                  <ChecklistRow diagram={webAppChecklist.classDiagram} />
                  <ChecklistRow diagram={webAppChecklist.guiDiagram} />
                </div>
              </div>

              {/* Optional / informational */}
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">{t('generation.webApp.optional')}</p>
                <div className="flex flex-col gap-2">
                  <AgentChecklistRow diagram={webAppChecklist.agentDiagram} />
                </div>
              </div>

              {/* Version selection — only when the GUI has page variants */}
              {webAppChecklist.hasAnyVariant && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('generation.webApp.versions')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('generation.webApp.versionsDescription')}
                  </p>
                  <RadioGroup
                    value={webAppVersionMode}
                    onValueChange={(v) => onWebAppVersionModeChange(v as WebAppVersionMode)}
                    className="self-start"
                  >
                    <RadioGroupItem value="base">{t('generation.webApp.versionBase')}</RadioGroupItem>
                    <RadioGroupItem value="profile">{t('generation.webApp.versionProfile')}</RadioGroupItem>
                    <RadioGroupItem value="all">{t('generation.webApp.versionAll')}</RadioGroupItem>
                  </RadioGroup>
                  {webAppVersionMode === 'profile' && (
                    <Select
                      value={webAppSelectedProfileId}
                      onValueChange={onWebAppSelectedProfileIdChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('generation.webApp.selectProfile')} />
                      </SelectTrigger>
                      <SelectContent>
                        {webAppChecklist.variantProfiles.map((p) => (
                          <SelectItem key={p.profileId} value={p.profileId}>
                            {p.profileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {webAppVersionMode === 'all' && (
                    <p className="text-xs text-muted-foreground">
                      {t('generation.webApp.versionAllHint')}
                    </p>
                  )}
                </div>
              )}

              {/* Hint */}
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <span className="mt-0.5 shrink-0" aria-hidden="true">&#x26A0;&#xFE0F;</span>
                <span>
                  {t('generation.webApp.referencesHint')}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 text-sm text-destructive">
              {t('generation.webApp.noProjectLoaded')}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={onWebAppGenerate}
              disabled={!webAppChecklist?.canGenerate}
            >
              {t('generation.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Checklist row for the Web App pre-generation dialog ──────────────────────

const ChecklistRow: React.FC<{ diagram: WebAppChecklistDiagramInfo }> = ({ diagram }) => {
  const { t } = useTranslation();
  const { label, title, exists, hasContent, required, referencedFrom } = diagram;

  let icon: string;
  let textClass: string;

  if (!exists && required) {
    // Required but missing entirely
    icon = '\u274C'; // red X
    textClass = 'text-destructive';
  } else if (exists && hasContent) {
    // Present with content
    icon = '\u2705'; // green check
    textClass = 'text-foreground';
  } else if (exists && !hasContent && required) {
    // Present but empty (required) -- warning
    icon = '\u26A0\uFE0F'; // warning
    textClass = 'text-amber-600 dark:text-amber-400';
  } else if (exists && !hasContent && !required) {
    // Optional and empty -- will be skipped
    icon = '\u2B1C'; // white square
    textClass = 'text-muted-foreground';
  } else {
    // Optional and missing -- will be skipped
    icon = '\u2B1C'; // white square
    textClass = 'text-muted-foreground';
  }

  const displayTitle = title || (exists ? t('generation.webApp.untitled') : t('generation.webApp.missing'));
  const emptyNote = exists && !hasContent ? t('generation.webApp.emptyWillBeSkipped') : '';

  return (
    <div className={`flex flex-col gap-0.5 rounded-md border border-border/60 px-3 py-2 text-sm ${textClass}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <span className="font-medium">{label}:</span>
        <span className="truncate">{`"${displayTitle}"${emptyNote}`}</span>
      </div>
      {referencedFrom && hasContent && (
        <div className="ml-7 text-xs text-muted-foreground">
          {t('generation.webApp.referencesClassDiagram', { title: referencedFrom })}
        </div>
      )}
      {!exists && required && (
        <div className="ml-7 text-xs text-destructive">
          {t('generation.webApp.diagramRequired')}
        </div>
      )}
      {exists && !hasContent && required && (
        <div className="ml-7 text-xs text-amber-600 dark:text-amber-400">
          {t('generation.webApp.diagramEmpty')}
        </div>
      )}
    </div>
  );
};

// ─── Agent checklist row — informational, not a blocker ───────────────────────

const AgentChecklistRow: React.FC<{ diagram: WebAppChecklistDiagramInfo }> = ({ diagram }) => {
  const { t } = useTranslation();
  const { label, exists } = diagram;

  // Agent diagrams are per-component in the GUI, so this is purely informational
  const icon = exists ? '\u2139\uFE0F' : '\u2B1C'; // info icon or white square
  const textClass = 'text-muted-foreground';

  return (
    <div className={`flex flex-col gap-0.5 rounded-md border border-border/60 px-3 py-2 text-sm ${textClass}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <span className="font-medium">{label}:</span>
        <span className="truncate">
          {exists
            ? diagram.title
            : t('generation.webApp.noAgentDiagrams')}
        </span>
      </div>
      <div className="ml-7 text-xs text-muted-foreground">
        {t('generation.webApp.agentDiagramsHint')}
      </div>
    </div>
  );
};
