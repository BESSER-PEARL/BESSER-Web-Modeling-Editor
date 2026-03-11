import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { settingsService } from '@besser/wme';
import { toast } from 'react-toastify';
import { Download } from 'lucide-react';
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
        <Card className="w-full max-w-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading project...</CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-2xl border-destructive/40">
          <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Open or create a project to edit settings.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-[#397C95]/10 dark:border-[#5BB8D4]/10">
          <CardHeader>
            <CardTitle className="text-[#397C95] dark:text-[#5BB8D4]">Project Settings</CardTitle>
            <CardDescription>Update metadata, inspect diagrams and manage export for the active project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#397C95] dark:text-[#5BB8D4]">Diagrams</h3>
              <div className="grid gap-3">
                {diagrams.map(({ type, diagram, index }) => (
                  <div key={`${type}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#397C95]/10 bg-[#397C95]/[0.02] p-3 dark:border-[#5BB8D4]/10 dark:bg-[#5BB8D4]/[0.02]">
                    <div>
                      <p className="text-sm font-medium">{diagram.title}</p>
                      <p className="text-xs text-muted-foreground">Updated {new Date(diagram.lastUpdate).toLocaleString()}</p>
                    </div>
                    <Badge className={colorByType[type]}>{type.replace('Diagram', '')}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#397C95]/10 p-3 dark:border-[#5BB8D4]/10">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Created</p>
                <p className="mt-1 text-sm font-medium">{new Date(currentProject.createdAt).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-[#397C95]/10 p-3 dark:border-[#5BB8D4]/10">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Current Diagram</p>
                <p className="mt-1 text-sm font-medium">{currentProject.currentDiagramType.replace('Diagram', '')}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-[#397C95]/10 bg-[#397C95]/[0.02] p-4 dark:border-[#5BB8D4]/10 dark:bg-[#5BB8D4]/[0.02]">
              <h3 className="text-sm font-semibold text-[#397C95] dark:text-[#5BB8D4]">Display Settings</h3>
              <label className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium">Show Instanced Objects</p>
                  <p className="text-xs text-muted-foreground">Toggle object instance visibility in diagrams.</p>
                </div>
                <input
                  type="checkbox"
                  className="accent-[#397C95] dark:accent-[#5BB8D4]"
                  checked={showInstancedObjects}
                  onChange={(event) => {
                    setShowInstancedObjects(event.target.checked);
                    settingsService.updateSetting('showInstancedObjects', event.target.checked);
                    toast.success(`Instanced objects ${event.target.checked ? 'enabled' : 'disabled'}.`);
                  }}
                />
              </label>
              <label className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium">Show Association Names</p>
                  <p className="text-xs text-muted-foreground">Toggle association name visibility for UML class diagrams.</p>
                </div>
                <input
                  type="checkbox"
                  className="accent-[#397C95] dark:accent-[#5BB8D4]"
                  checked={showAssociationNames}
                  onChange={(event) => {
                    setShowAssociationNames(event.target.checked);
                    settingsService.updateSetting('showAssociationNames', event.target.checked);
                    toast.success(`Association names ${event.target.checked ? 'enabled' : 'disabled'}.`);
                  }}
                />
              </label>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleExportProject} disabled={isExporting} className="gap-2 bg-[#397C95] text-white hover:bg-[#2C6A82] dark:bg-[#5BB8D4] dark:text-slate-900 dark:hover:bg-[#4AA8C4]">
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export Project'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
