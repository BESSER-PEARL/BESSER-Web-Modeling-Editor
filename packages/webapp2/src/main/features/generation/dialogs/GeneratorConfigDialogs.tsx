import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { FormField } from '@/components/ui/form-field';
import type { JSONSchemaConfig, QiskitConfig, SQLAlchemyConfig, SQLConfig } from '../hooks/useGenerateCode';
import type { ConfigDialog } from '../generator-dialog-config';
import { SHOW_FULL_AGENT_CONFIGURATION } from '../../../shared/constants/constant';
import type { StoredAgentConfiguration, StoredAgentProfileConfigurationMapping } from '../../../shared/services/storage/local-storage-types';
import type { AgentLLMProvider, IntentRecognitionTechnology } from '../../../shared/types/agent-config';
import type { AgentGenerationMode, AgentGenerationVariantOption, WebAppChecklistInfo, WebAppChecklistDiagramInfo } from '../useGeneratorExecution';
import { validateProjectName, validateNumberRange } from '../../../shared/utils/validation';
import { useFieldValidation } from '../../../shared/hooks/useFieldValidation';

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
  /** Agent runtime platform selected in generation dialog. */
  agentPlatform: string;
  /** Intent recognition mode selected in generation dialog. */
  intentRecognitionTechnology: IntentRecognitionTechnology;
  /** Optional LLM provider selected in generation dialog. */
  agentLlmProvider: AgentLLMProvider;
  /** Optional selected model for OpenAI provider. */
  agentLlmModel: string;
  /** Optional custom model name when "other" is selected. */
  agentCustomLlmModel: string;
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
  onAgentPlatformChange: (value: string) => void;
  onIntentRecognitionTechnologyChange: (value: IntentRecognitionTechnology) => void;
  onAgentLlmProviderChange: (value: AgentLLMProvider) => void;
  onAgentLlmModelChange: (value: string) => void;
  onAgentCustomLlmModelChange: (value: string) => void;
  onAgentGenerationModeChange: (value: AgentGenerationMode) => void;

  // ── Web App checklist ──────────────────────────────────────────────────
  /** Pre-generation checklist info for the web_app generator. */
  webAppChecklist: WebAppChecklistInfo | null;

  // ── Execution callbacks (one per generator) ──────────────────────────────
  /** Validate inputs, call the backend, and close the dialog on success. */
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
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
  agentPlatform,
  intentRecognitionTechnology,
  agentLlmProvider,
  agentLlmModel,
  agentCustomLlmModel,
  agentGenerationMode,
  onDjangoProjectNameChange,
  onDjangoAppNameChange,
  onUseDockerChange,
  onSqlDialectChange,
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
  onAgentPlatformChange,
  onIntentRecognitionTechnologyChange,
  onAgentLlmProviderChange,
  onAgentLlmModelChange,
  onAgentCustomLlmModelChange,
  onAgentGenerationModeChange,
  webAppChecklist,
  onDjangoGenerate,
  onDjangoDeploy,
  onSqlGenerate,
  onSqlAlchemyGenerate,
  onJsonSchemaGenerate,
  onAgentGenerate,
  onQiskitGenerate,
  onWebAppGenerate,
}) => {
  const navigate = useNavigate();

  // ── Django inline validation ──────────────────────────────────────────
  const djangoValidators = useMemo(() => ({
    projectName: () => validateProjectName(djangoProjectName),
    appName: () => validateProjectName(djangoAppName),
  }), [djangoProjectName, djangoAppName]);
  const djangoValidation = useFieldValidation(djangoValidators);

  // ── Qiskit inline validation ──────────────────────────────────────────
  const qiskitValidators = useMemo(() => ({
    shots: () => validateNumberRange(qiskitShots, 1, 100000, 'Shots'),
  }), [qiskitShots]);
  const qiskitValidation = useFieldValidation(qiskitValidators);

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
            <DialogTitle>Django Project Configuration</DialogTitle>
            <DialogDescription>Configure names and containerization options for Django generation.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <FormField label="Project Name" htmlFor="django-project-name" required error={djangoValidation.getError('projectName')}>
              <Input
                id="django-project-name"
                value={djangoProjectName}
                onChange={(event) => onDjangoProjectNameChange(event.target.value.replace(/\s/g, '_'))}
                onBlur={() => djangoValidation.markTouched('projectName')}
                placeholder="my_django_project"
                className={djangoValidation.getError('projectName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
              />
            </FormField>
            <FormField label="App Name" htmlFor="django-app-name" required error={djangoValidation.getError('appName')}>
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
              Include Docker containerization
              <input type="checkbox" checked={useDocker} onChange={(event) => onUseDockerChange(event.target.checked)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onDjangoGenerate} disabled={!djangoValidation.isValid}>Generate</Button>
            {isLocalEnvironment && (
              <Button variant="secondary" onClick={onDjangoDeploy} disabled={!djangoValidation.isValid}>
                Deploy
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'sql'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SQL Dialect Selection</DialogTitle>
            <DialogDescription>Choose the SQL dialect for generated DDL statements.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Dialect</Label>
            <Select value={sqlDialect} onValueChange={(value) => onSqlDialectChange(value as SQLConfig['dialect'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select SQL dialect" />
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
              Cancel
            </Button>
            <Button onClick={onSqlGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'sqlalchemy'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SQLAlchemy DBMS Selection</DialogTitle>
            <DialogDescription>Choose the database system for generated SQLAlchemy code.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>DBMS</Label>
            <Select
              value={sqlAlchemyDbms}
              onValueChange={(value) => onSqlAlchemyDbmsChange(value as SQLAlchemyConfig['dbms'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select DBMS" />
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
              Cancel
            </Button>
            <Button onClick={onSqlAlchemyGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'jsonschema'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>JSON Schema Mode</DialogTitle>
            <DialogDescription>Pick regular JSON schema or NGSI-LD smart data mode.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <Select value={jsonSchemaMode} onValueChange={(value) => onJsonSchemaModeChange(value as JSONSchemaConfig['mode'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular JSON Schema</SelectItem>
                <SelectItem value="smart_data">Smart Data Models</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onJsonSchemaGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'agent'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Agent Languages</DialogTitle>
            <DialogDescription>Configure source and target languages for agent translation.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {!hasSavedAgentConfiguration && (
              <div className="p-3 border rounded bg-muted/30">
                <div className="text-sm text-muted-foreground mb-2">
                  No saved configuration found. The agent will be generated with the default configuration.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closeDialog(setConfigDialog);
                    navigate('/agent-config');
                  }}
                >
                  Configure agent technologies
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Source language (optional)</Label>
              <Select value={sourceLanguage} onValueChange={onSourceLanguageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select language...</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                  <SelectItem value="german">German</SelectItem>
                  <SelectItem value="luxembourgish">Luxembourgish</SelectItem>
                  <SelectItem value="portuguese">Portuguese</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Add spoken language for agent translation</Label>
              <div className="flex gap-2">
                <Select value={pendingAgentLanguage} onValueChange={onPendingAgentLanguageChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select language...</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                    <SelectItem value="luxembourgish">Luxembourgish</SelectItem>
                    <SelectItem value="portuguese">Portuguese</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
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
                  Add Language
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                The agent will be translated to all selected spoken languages.
              </p>
              <div className="text-sm text-amber-600 flex items-center gap-1">
                <span role="img" aria-label="warning">⚠️</span>
                <span>Adding more languages will increase the generation time.</span>
              </div>
            </div>

            <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-platform">Platform</Label>
                  <select
                    id="agent-platform"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={agentPlatform}
                    onChange={(event) => onAgentPlatformChange(event.target.value)}
                  >
                    <option value="websocket">WebSocket</option>
                    <option value="streamlit">WebSocket with Streamlit interface</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="intent-recognition">Intent Recognition</Label>
                  <select
                    id="intent-recognition"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={intentRecognitionTechnology}
                    onChange={(event) => onIntentRecognitionTechnologyChange(event.target.value as IntentRecognitionTechnology)}
                  >
                    <option value="classical">Classical</option>
                    <option value="llm-based">LLM-based</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="llm-provider">LLM Provider (optional)</Label>
                  <select
                    id="llm-provider"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={agentLlmProvider}
                    onChange={(event) => {
                      const value = event.target.value as AgentLLMProvider;
                      onAgentLlmProviderChange(value);
                      onAgentLlmModelChange('');
                      onAgentCustomLlmModelChange('');
                    }}
                  >
                    <option value="">None</option>
                    <option value="openai">OpenAI</option>
                    <option value="huggingface">HuggingFace</option>
                    <option value="huggingfaceapi">HuggingFace API</option>
                    <option value="replicate">Replicate</option>
                  </select>
                </div>

                {agentLlmProvider === 'openai' && (
                  <div className="space-y-2">
                    <Label htmlFor="openai-model">OpenAI Model</Label>
                    <select
                      id="openai-model"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={agentLlmModel}
                      onChange={(event) => {
                        onAgentLlmModelChange(event.target.value);
                        if (event.target.value !== 'other') {
                          onAgentCustomLlmModelChange('');
                        }
                      }}
                    >
                      <option value="">None</option>
                      <option value="gpt-5">GPT-5</option>
                      <option value="gpt-5-mini">GPT-5 Mini</option>
                      <option value="gpt-5-nano">GPT-5 Nano</option>
                      <option value="other">Other</option>
                    </select>

                    {agentLlmModel === 'other' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="openai-custom-model">Custom Model Name</Label>
                        <Input
                          id="openai-custom-model"
                          value={agentCustomLlmModel}
                          onChange={(event) => onAgentCustomLlmModelChange(event.target.value)}
                          placeholder="Enter model name"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {agentVariantOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Personalization Strategy</Label>
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
                    <Label htmlFor="variant-mode-none" className="text-sm font-normal">None</Label>
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
                    <Label htmlFor="variant-mode-personalization" className="text-sm font-normal">Personalization (all)</Label>
                  </div>
                </div>

                {agentGenerationMode === 'personalization' ? (
                  <p className="text-xs text-muted-foreground">
                    Sends all available profile-to-configuration personalization mappings to the backend.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Generates without attaching saved personalization variants or advanced configuration payloads.
                  </p>
                )}
              </div>
            )}

            {SHOW_FULL_AGENT_CONFIGURATION && (
              <div className="flex flex-col gap-1.5">
                <Label>Mode</Label>
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
                    <Label htmlFor="mode-original" className="text-sm font-normal">Original</Label>
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
                    <Label htmlFor="mode-config" className="text-sm font-normal">Configuration</Label>
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
                    <Label htmlFor="mode-personalization" className="text-sm font-normal">Personalization</Label>
                  </div>
                </div>
              </div>
            )}

            {SHOW_FULL_AGENT_CONFIGURATION && (agentMode === 'configuration' || agentMode === 'personalization') && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  {agentMode === 'personalization'
                    ? 'Select profile → configuration mappings'
                    : 'Select stored configurations'}
                </Label>
                {agentMode === 'personalization' ? (
                  storedAgentMappings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No mappings with generated agents found. Create mappings and run "Save & Apply" first.
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
                        Only mappings whose target configuration already has a generated agent are listed.
                      </p>
                    </div>
                  )
                ) : (
                  storedAgentConfigurations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No saved configurations with generated agents found. Use "Save & Apply" first to make them available here.
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
                        Select one or more configurations (only entries with generated agents are listed) to include in the request. This will generate one agent per configuration.
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            {selectedAgentLanguages.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Selected Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedAgentLanguages.map((language) => (
                    <button
                      key={language}
                      type="button"
                      className="rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs hover:bg-muted/60"
                      onClick={() =>
                        onSelectedAgentLanguagesChange(selectedAgentLanguages.filter((entry) => entry !== language))
                      }
                      aria-label={`Remove ${language} language`}
                    >
                      {language.charAt(0).toUpperCase() + language.slice(1)} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onAgentGenerate}>Generate</Button>
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
            <DialogTitle>Qiskit Backend Configuration</DialogTitle>
            <DialogDescription>Choose execution backend and number of shots.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Execution Backend</Label>
              <Select value={qiskitBackend} onValueChange={(value) => onQiskitBackendChange(value as QiskitConfig['backend'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select backend" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aer_simulator">Aer Simulator (Local)</SelectItem>
                  <SelectItem value="fake_backend">Mock Simulation (Noise Simulation)</SelectItem>
                  <SelectItem value="ibm_quantum">IBM Quantum (Real Hardware)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormField label="Number of Shots" htmlFor="qiskit-shots" required error={qiskitValidation.getError('shots')}>
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
              Cancel
            </Button>
            <Button onClick={onQiskitGenerate} disabled={!qiskitValidation.isValid}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialog === 'web_app_checklist'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Web Application Generator</DialogTitle>
            <DialogDescription>The following diagrams will be used for generation.</DialogDescription>
          </DialogHeader>
          {webAppChecklist ? (
            <div className="flex flex-col gap-4">
              {/* Required diagrams */}
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">Required</p>
                <div className="flex flex-col gap-2">
                  <ChecklistRow diagram={webAppChecklist.classDiagram} />
                  <ChecklistRow diagram={webAppChecklist.guiDiagram} />
                </div>
              </div>

              {/* Optional / informational */}
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">Optional</p>
                <div className="flex flex-col gap-2">
                  <AgentChecklistRow diagram={webAppChecklist.agentDiagram} />
                </div>
              </div>

              {/* Hint */}
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <span className="mt-0.5 shrink-0" aria-hidden="true">&#x26A0;&#xFE0F;</span>
                <span>
                  If the Class or GUI diagram is not correct, change the references in the diagram tabs before generating.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 text-sm text-destructive">
              No project is loaded. Create or load a project first.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button
              onClick={onWebAppGenerate}
              disabled={!webAppChecklist?.canGenerate}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Checklist row for the Web App pre-generation dialog ──────────────────────

const ChecklistRow: React.FC<{ diagram: WebAppChecklistDiagramInfo }> = ({ diagram }) => {
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

  const displayTitle = title || (exists ? '(untitled)' : '(missing)');
  const emptyNote = exists && !hasContent ? ' (empty - will be skipped)' : '';

  return (
    <div className={`flex flex-col gap-0.5 rounded-md border border-border/60 px-3 py-2 text-sm ${textClass}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <span className="font-medium">{label}:</span>
        <span className="truncate">{`"${displayTitle}"${emptyNote}`}</span>
      </div>
      {referencedFrom && hasContent && (
        <div className="ml-7 text-xs text-muted-foreground">
          References: Class Diagram &quot;{referencedFrom}&quot;
        </div>
      )}
      {!exists && required && (
        <div className="ml-7 text-xs text-destructive">
          This diagram is required for Web App generation.
        </div>
      )}
      {exists && !hasContent && required && (
        <div className="ml-7 text-xs text-amber-600 dark:text-amber-400">
          This diagram is empty. Generation may produce incomplete results.
        </div>
      )}
    </div>
  );
};

// ─── Agent checklist row — informational, not a blocker ───────────────────────

const AgentChecklistRow: React.FC<{ diagram: WebAppChecklistDiagramInfo }> = ({ diagram }) => {
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
            : 'No Agent Diagrams in project'}
        </span>
      </div>
      <div className="ml-7 text-xs text-muted-foreground">
        Agent diagrams are linked per-component inside the GUI editor (drag &amp; drop).
      </div>
    </div>
  );
};
