import React, { useEffect, useMemo, useState } from 'react';
import { ApollonEditor } from '@besser/wme';
import { Download, FileCode2, FileImage, FileJson2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UMLModel } from '@besser/wme';
import { useProject } from '../../hooks/useProject';
import { ProjectDiagram, SupportedDiagramType, getReferencedDiagram, isUMLModel } from '../../types/project';
import { useExportPNG } from '../../services/export/useExportPng';
import { useExportSVG } from '../../services/export/useExportSvg';
import { useExportBUML } from '../../services/export/useExportBuml';
import { useExportJSON } from '../../services/export/useExportJson';
import { exportProjectById } from '../../services/export/useExportProjectJSON';
import { exportProjectAsSingleBUMLFile } from '../../services/export/useExportProjectBUML';
import { useAppSelector } from '../../store/hooks';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor?: ApollonEditor;
  currentDiagramTitle: string;
}

type ExportFormat = 'SVG' | 'PNG_WHITE' | 'PNG' | 'JSON' | 'BUML' | 'SINGLE_JSON' | 'SINGLE_BUML';

const diagramLabels: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'Class Diagram',
  ObjectDiagram: 'Object Diagram',
  StateMachineDiagram: 'State Machine Diagram',
  AgentDiagram: 'Agent Diagram',
  GUINoCodeDiagram: 'GUI No-Code Diagram',
  QuantumCircuitDiagram: 'Quantum Circuit Diagram',
};

const formatsRequiringSelection = new Set<ExportFormat>(['JSON', 'BUML']);

export const ExportDialog: React.FC<ExportDialogProps> = ({ open, onOpenChange, editor, currentDiagramTitle }) => {
  const { currentProject } = useProject();
  const diagram = useAppSelector((state) => state.workspace.activeDiagram);
  const exportAsSVG = useExportSVG();
  const exportAsPNG = useExportPNG();
  const exportAsBUML = useExportBUML();
  const exportAsJSON = useExportJSON();
  const [selectedDiagrams, setSelectedDiagrams] = useState<SupportedDiagramType[]>([]);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  const diagramEntries = useMemo<[SupportedDiagramType, ProjectDiagram][]>(
    () => {
      if (!currentProject) return [];
      return Object.entries(currentProject.diagrams).flatMap(
        ([type, diagrams]) => {
          const arr = diagrams as ProjectDiagram[];
          const idx = currentProject.currentDiagramIndices[type as SupportedDiagramType] ?? 0;
          const active = arr[idx] ?? arr[0];
          return active ? [[type as SupportedDiagramType, active] as [SupportedDiagramType, ProjectDiagram]] : [];
        }
      );
    },
    // Only recompute when the project id or diagram structure actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentProject?.id, currentProject?.diagrams]
  );

  // Pre-select diagrams only when dialog opens, not on every project change
  useEffect(() => {
    if (!open) {
      setHasInitializedSelection(false);
      return;
    }
    if (hasInitializedSelection) return;

    if (diagramEntries.length === 0) {
      setSelectedDiagrams([]);
    } else {
      setSelectedDiagrams(diagramEntries.map(([type]) => type).filter((type) => type !== 'GUINoCodeDiagram'));
    }
    setHasInitializedSelection(true);
  }, [open, diagramEntries, hasInitializedSelection]);

  const toggleDiagramSelection = (diagramType: SupportedDiagramType) => {
    setSelectedDiagrams((previous) =>
      previous.includes(diagramType)
        ? previous.filter((type) => type !== diagramType)
        : [...previous, diagramType]
    );
  };

  const handleExport = async (format: ExportFormat) => {
    const isImageExport = format === 'SVG' || format === 'PNG' || format === 'PNG_WHITE';
    const isSingleDiagramExport = format === 'SINGLE_JSON' || format === 'SINGLE_BUML';
    const normalizedTitle = currentDiagramTitle.trim() || 'Diagram';

    if ((isImageExport || isSingleDiagramExport) && !editor) {
      toast.error('Open a UML diagram first.');
      return;
    }

    if (!currentProject) {
      toast.error('No project available to export.');
      return;
    }

    if (formatsRequiringSelection.has(format) && selectedDiagrams.length === 0) {
      toast.error('Select at least one diagram to export.');
      return;
    }

    try {
      if (format === 'SVG') {
        await exportAsSVG(editor!, normalizedTitle);
      } else if (format === 'PNG_WHITE') {
        await exportAsPNG(editor!, normalizedTitle, true);
      } else if (format === 'PNG') {
        await exportAsPNG(editor!, normalizedTitle, false);
      } else if (format === 'JSON') {
        await exportProjectById(currentProject, selectedDiagrams);
      } else if (format === 'BUML') {
        await exportProjectAsSingleBUMLFile(currentProject, selectedDiagrams);
      } else if (format === 'SINGLE_BUML') {
        // Include the referenced ClassDiagram data for diagram types that depend on it
        let refData: UMLModel | undefined;
        const modelType = editor!.model?.type;
        if (
          (modelType === 'ObjectDiagram' || modelType === 'StateMachineDiagram') &&
          currentProject &&
          diagram
        ) {
          const classDiagram = getReferencedDiagram(currentProject, diagram, 'ClassDiagram');
          if (isUMLModel(classDiagram?.model)) {
            refData = classDiagram.model;
          }
        }
        await exportAsBUML(editor!, normalizedTitle, refData);
      } else if (format === 'SINGLE_JSON') {
        if (diagram) exportAsJSON(editor!, diagram as any);
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Project
          </DialogTitle>
          <DialogDescription>Export full project files or current diagram assets.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-xl border border-slate-300/70 bg-slate-50/90 p-4">
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileJson2 className="h-4 w-4" />
              Multiple Diagrams
            </h3>
            <p className="mb-3 text-xs text-slate-600">Export selected diagrams as JSON or B-UML.</p>

            {diagramEntries.length > 0 ? (
              <>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3">
                  {diagramEntries.map(([type, projectDiagram]) => (
                    <label key={type} className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-800"
                        checked={selectedDiagrams.includes(type)}
                        onChange={() => toggleDiagramSelection(type)}
                      />
                      <span>{projectDiagram.title || diagramLabels[type]}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 grid gap-2">
                  <Button onClick={() => handleExport('JSON')} className="justify-start gap-2">
                    <FileJson2 className="h-4 w-4" />
                    Export as JSON
                  </Button>
                  <Button variant="secondary" onClick={() => handleExport('BUML')} className="justify-start gap-2">
                    <FileCode2 className="h-4 w-4" />
                    Export as B-UML
                  </Button>
                </div>
              </>
            ) : (
              <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500">
                No diagrams available in the current project.
              </p>
            )}
          </section>

          <section className="flex flex-col rounded-xl border border-slate-300/70 bg-slate-50/90 p-4">
            <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileImage className="h-4 w-4" />
              Current Diagram
            </h3>
            <p className="mb-3 text-xs text-slate-600">Export the current UML diagram as image assets.</p>

            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {currentDiagramTitle || 'Untitled diagram'}
            </div>

            <div className="grid gap-2">
              <Button variant="outline" onClick={() => handleExport('SVG')} className="justify-start gap-2">
                <FileCode2 className="h-4 w-4" />
                Export as SVG
              </Button>
              <Button variant="outline" onClick={() => handleExport('PNG_WHITE')} className="justify-start gap-2">
                <FileImage className="h-4 w-4" />
                Export PNG (White)
              </Button>
              <Button variant="outline" onClick={() => handleExport('PNG')} className="justify-start gap-2">
                <FileImage className="h-4 w-4" />
                Export PNG (Transparent)
              </Button>
              <Button variant="outline" onClick={() => handleExport('SINGLE_JSON')} className="justify-start gap-2">
                <FileJson2 className="h-4 w-4" />
                Export Diagram as JSON
              </Button>
              <Button variant="outline" onClick={() => handleExport('SINGLE_BUML')} className="justify-start gap-2">
                <FileCode2 className="h-4 w-4" />
                Export Diagram as B-UML
              </Button>
            </div>

            {!editor && (
              <p className="mt-3 text-xs text-amber-700">
                Current diagram exports require a UML diagram view. Use project-level export instead.
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
