import React from 'react';
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
import type { JSONSchemaConfig, QiskitConfig, SQLAlchemyConfig, SQLConfig } from '../../../services/generate-code/useGenerateCode';
import type { ConfigDialog } from '../../../services/generate-code/generator-dialog-config';
import { SHOW_FULL_AGENT_CONFIGURATION } from '../../../constant';
import type { StoredAgentConfiguration, StoredAgentProfileConfigurationMapping } from '../../../services/local-storage/local-storage-types';

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
  /** Whether at least one agent configuration exists in localStorage. */
  hasSavedAgentConfiguration: boolean;
  /** Advanced mode selector (visible only when SHOW_FULL_AGENT_CONFIGURATION). */
  agentMode: 'original' | 'configuration' | 'personalization';
  /** Stored agent configurations loaded from localStorage. */
  storedAgentConfigurations: StoredAgentConfiguration[];
  /** Profile → configuration mappings for personalization mode. */
  storedAgentMappings: Array<StoredAgentProfileConfigurationMapping & { userProfileLabel: string; agentConfigurationLabel: string }>;
  /** IDs of the currently selected stored configurations / mappings. */
  selectedStoredAgentConfigIds: string[];

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

  // ── Execution callbacks (one per generator) ──────────────────────────────
  /** Validate inputs, call the backend, and close the dialog on success. */
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
  onSqlAlchemyGenerate: () => void;
  onJsonSchemaGenerate: () => void;
  onAgentGenerate: () => void;
  onQiskitGenerate: () => void;
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
  onDjangoGenerate,
  onDjangoDeploy,
  onSqlGenerate,
  onSqlAlchemyGenerate,
  onJsonSchemaGenerate,
  onAgentGenerate,
  onQiskitGenerate,
}) => {
  const navigate = useNavigate();
  return (
    <>
      <Dialog open={configDialog === 'django'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Django Project Configuration</DialogTitle>
            <DialogDescription>Configure names and containerization options for Django generation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="django-project-name">Project Name</Label>
              <Input
                id="django-project-name"
                value={djangoProjectName}
                onChange={(event) => onDjangoProjectNameChange(event.target.value.replace(/\s/g, '_'))}
                placeholder="my_django_project"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="django-app-name">App Name</Label>
              <Input
                id="django-app-name"
                value={djangoAppName}
                onChange={(event) => onDjangoAppNameChange(event.target.value.replace(/\s/g, '_'))}
                placeholder="my_app"
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
              Include Docker containerization
              <input type="checkbox" checked={useDocker} onChange={(event) => onUseDockerChange(event.target.checked)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onDjangoGenerate}>Generate</Button>
            {isLocalEnvironment && (
              <Button variant="secondary" onClick={onDjangoDeploy}>
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-4">
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

            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
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

            {SHOW_FULL_AGENT_CONFIGURATION && (
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="mode-original"
                      name="agentMode"
                      checked={agentMode === 'original'}
                      onChange={() => onAgentModeChange('original')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="mode-original" className="text-sm font-normal">Original</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="mode-config"
                      name="agentMode"
                      checked={agentMode === 'configuration'}
                      onChange={() => onAgentModeChange('configuration')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="mode-config" className="text-sm font-normal">Configuration</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="mode-personalization"
                      name="agentMode"
                      checked={agentMode === 'personalization'}
                      onChange={() => onAgentModeChange('personalization')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="mode-personalization" className="text-sm font-normal">Personalization</Label>
                  </div>
                </div>
              </div>
            )}

            {SHOW_FULL_AGENT_CONFIGURATION && (agentMode === 'configuration' || agentMode === 'personalization') && (
              <div className="space-y-1.5">
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
                    <div className="space-y-2">
                      {storedAgentMappings.map((mapping) => (
                        <div key={mapping.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`storedAgentMapping-${mapping.id}`}
                            checked={selectedStoredAgentConfigIds.includes(mapping.agentConfigurationId)}
                            onChange={() => onStoredAgentConfigToggle(mapping.agentConfigurationId)}
                            className="h-4 w-4"
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
                    <div className="space-y-2">
                      {storedAgentConfigurations.map((entry) => (
                        <div key={entry.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`storedAgentConfig-${entry.id}`}
                            checked={selectedStoredAgentConfigIds.includes(entry.id)}
                            onChange={() => onStoredAgentConfigToggle(entry.id)}
                            className="h-4 w-4"
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
              <div className="space-y-2">
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

      <Dialog open={configDialog === 'qiskit'} onOpenChange={(open) => !open && closeDialog(setConfigDialog)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qiskit Backend Configuration</DialogTitle>
            <DialogDescription>Choose execution backend and number of shots.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="qiskit-shots">Number of Shots</Label>
              <Input
                id="qiskit-shots"
                type="number"
                min={1}
                max={100000}
                value={qiskitShots}
                onChange={(event) => onQiskitShotsChange(Math.max(1, Number(event.target.value || 1024)))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(setConfigDialog)}>
              Cancel
            </Button>
            <Button onClick={onQiskitGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
