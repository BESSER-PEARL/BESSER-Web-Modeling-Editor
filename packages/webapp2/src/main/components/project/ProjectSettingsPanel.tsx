import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { settingsService } from '@besser/wme';
import { toast } from 'react-toastify';
import { Download, FolderKanban, Layers3, Monitor, Settings } from 'lucide-react';
import { useProject } from '../../hooks/useProject';
import { SupportedDiagramType, ProjectDiagram } from '../../types/project';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FormField } from '@/components/ui/form-field';
import { validateProjectName } from '../../utils/validation';
import { useFieldValidation } from '../../hooks/useFieldValidation';

const colorByType: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-300',
  ObjectDiagram: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
  StateMachineDiagram: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
  AgentDiagram: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  GUINoCodeDiagram: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300',
  QuantumCircuitDiagram: 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-300',
};

export const ProjectSettingsPanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [showInstancedObjects, setShowInstancedObjects] = useState(false);
  const [showAssociationNames, setShowAssociationNames] = useState(false);

  const { currentProject, loading, error, updateProject, exportProject } = useProject();

  useEffect(() => {
    setShowInstancedObjects(settingsService.shouldShowInstancedObjects());
    setShowAssociationNames(settingsService.shouldShowAssociationNames());
  }, []);

  const diagrams = useMemo(() => {
    if (!currentProject) return [];
    return Object.entries(currentProject.diagrams).flatMap(([type, diagramArr]) =>
      (diagramArr as ProjectDiagram[]).map((diagram, index) => ({
        type: type as SupportedDiagramType,
        diagram,
        index,
      })),
    );
  }, [currentProject]);

  // ── Inline validation for project name ─────────────────────────────────
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
      toast.success('Project exported successfully.');
    } catch (exportError) {
      toast.error(`Failed to export project: ${exportError instanceof Error ? exportError.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading project...</p>
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
        <p className="text-sm text-muted-foreground">Open or create a project to edit settings.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Page header */}
      <div className="border-b border-border/40 bg-background/80 px-6 py-5 backdrop-blur-sm sm:px-10">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Project Settings</h1>
            <p className="text-sm text-muted-foreground">Manage metadata, diagrams, and display preferences</p>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8 sm:px-10">

        {/* General info */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-brand" />
              <CardTitle className="text-base">General</CardTitle>
            </div>
            <CardDescription>Basic project information</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Project Name" htmlFor="settings-name" required error={settingsValidation.getError('name')}>
                <Input
                  id="settings-name"
                  value={currentProject.name}
                  onChange={(event) => handleProjectField('name', event.target.value)}
                  onBlur={() => settingsValidation.markTouched('name')}
                  className={settingsValidation.getError('name') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                />
              </FormField>
              <FormField label="Owner" htmlFor="settings-owner">
                <Input id="settings-owner" value={currentProject.owner} onChange={(event) => handleProjectField('owner', event.target.value)} />
              </FormField>
            </div>
            <FormField label="Description" htmlFor="settings-description">
              <Textarea
                id="settings-description"
                value={currentProject.description}
                onChange={(event) => handleProjectField('description', event.target.value)}
                className="min-h-24"
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</p>
                <p className="mt-1 text-sm">{new Date(currentProject.createdAt).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Editor</p>
                <p className="mt-1 text-sm">{currentProject.currentDiagramType.replace('Diagram', '')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diagrams */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-brand" />
              <CardTitle className="text-base">Diagrams</CardTitle>
            </div>
            <CardDescription>{diagrams.length} diagram{diagrams.length !== 1 ? 's' : ''} in this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {diagrams.map(({ type, diagram, index }) => (
                <div key={`${type}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{diagram.title}</p>
                    <p className="text-xs text-muted-foreground">Updated {new Date(diagram.lastUpdate).toLocaleString()}</p>
                  </div>
                  <Badge className={colorByType[type]}>{type.replace('Diagram', '')}</Badge>
                </div>
              ))}
              {diagrams.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No diagrams yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Display settings */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-brand" />
              <CardTitle className="text-base">Display</CardTitle>
            </div>
            <CardDescription>Configure how diagrams are rendered in the editor</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors hover:bg-muted/30">
              <div>
                <p className="text-sm font-medium">Show Instanced Objects</p>
                <p className="text-xs text-muted-foreground">Toggle object instance visibility in diagrams</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={showInstancedObjects}
                onChange={(event) => {
                  setShowInstancedObjects(event.target.checked);
                  settingsService.updateSetting('showInstancedObjects', event.target.checked);
                  toast.success(`Instanced objects ${event.target.checked ? 'enabled' : 'disabled'}.`);
                }}
              />
            </label>
            <Separator />
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-3 transition-colors hover:bg-muted/30">
              <div>
                <p className="text-sm font-medium">Show Association Names</p>
                <p className="text-xs text-muted-foreground">Toggle association name visibility for UML class diagrams</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={showAssociationNames}
                onChange={(event) => {
                  setShowAssociationNames(event.target.checked);
                  settingsService.updateSetting('showAssociationNames', event.target.checked);
                  toast.success(`Association names ${event.target.checked ? 'enabled' : 'disabled'}.`);
                }}
              />
            </label>
          </CardContent>
        </Card>

        {/* Export */}
        <div className="flex justify-end pb-4">
          <Button onClick={handleExportProject} disabled={isExporting} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export Project'}
          </Button>
        </div>

      </div>
    </div>
  );
};
