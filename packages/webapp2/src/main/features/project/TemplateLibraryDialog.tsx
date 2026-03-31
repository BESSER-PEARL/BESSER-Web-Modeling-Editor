import React, { useMemo, useState } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Check, Layers, Sparkles, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  switchDiagramTypeThunk,
  updateQuantumDiagramThunk,
  addDiagramThunk,
  switchDiagramIndexThunk,
  selectProject,
} from '../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { toSupportedDiagramType, getActiveDiagram } from '../../shared/types/project';
import { QuantumCircuitData } from '../../shared/types/project';
import { TemplateFactory } from './create-diagram-from-template-modal/template-factory';
import {
  SoftwarePatternCategory,
  SoftwarePatternTemplate,
  SoftwarePatternType,
} from './create-diagram-from-template-modal/software-pattern/software-pattern-types';

interface TemplateLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryOrder: SoftwarePatternCategory[] = [
  SoftwarePatternCategory.STRUCTURAL,
  SoftwarePatternCategory.BEHAVIORAL,
  SoftwarePatternCategory.CREATIONAL,
  SoftwarePatternCategory.STATE_MACHINE,
  SoftwarePatternCategory.AGENT,
  SoftwarePatternCategory.QUANTUM_CIRCUIT,
];

const categoryColor: Record<SoftwarePatternCategory, string> = {
  [SoftwarePatternCategory.STRUCTURAL]: 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-300',
  [SoftwarePatternCategory.BEHAVIORAL]: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
  [SoftwarePatternCategory.CREATIONAL]: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
  [SoftwarePatternCategory.STATE_MACHINE]: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300',
  [SoftwarePatternCategory.AGENT]: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  [SoftwarePatternCategory.QUANTUM_CIRCUIT]: 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-300',
};

export const TemplateLibraryDialog: React.FC<TemplateLibraryDialogProps> = ({ open, onOpenChange }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const templates = useMemo(() => {
    return Object.values(SoftwarePatternType).map((pattern) => TemplateFactory.createSoftwarePattern(pattern));
  }, []);

  const categories = useMemo(() => {
    return categoryOrder.filter((category) => templates.some((template) => template.softwarePatternCategory === category));
  }, [templates]);

  const [selectedCategory, setSelectedCategory] = useState<SoftwarePatternCategory>(categories[0]);
  const templatesInCategory = useMemo(
    () => templates.filter((template) => template.softwarePatternCategory === selectedCategory),
    [templates, selectedCategory],
  );

  const [selectedTemplateType, setSelectedTemplateType] = useState<SoftwarePatternType>(
    templatesInCategory[0]?.type ?? SoftwarePatternType.LIBRARY_COMPLETE,
  );

  React.useEffect(() => {
    if (!templatesInCategory.find((template) => template.type === selectedTemplateType)) {
      setSelectedTemplateType(templatesInCategory[0]?.type ?? SoftwarePatternType.LIBRARY);
    }
  }, [templatesInCategory, selectedTemplateType]);

  const selectedTemplate = useMemo<SoftwarePatternTemplate | undefined>(
    () => templates.find((template) => template.type === selectedTemplateType),
    [templates, selectedTemplateType],
  );

  const currentProject = useAppSelector(selectProject);

  const hasExistingModel = useMemo(() => {
    if (!currentProject || !selectedTemplate) return false;
    const umlType = selectedTemplate.diagramType as UMLDiagramType;
    const supportedType = toSupportedDiagramType(umlType);
    const existing = getActiveDiagram(currentProject, supportedType);
    const model = existing?.model;
    if (!model || typeof model !== 'object') return false;
    const elements = (model as any).elements;
    return elements && typeof elements === 'object' && Object.keys(elements).length > 0;
  }, [currentProject, selectedTemplate]);

  const handleLoadClick = () => {
    if (!selectedTemplate) return;
    if (hasExistingModel) {
      setShowConfirm(true);
    } else {
      doLoadTemplate();
    }
  };

  const doLoadTemplate = async (mode: 'replace' | 'new_tab' = 'replace') => {
    if (!selectedTemplate) return;
    setShowConfirm(false);

    try {
      setIsLoading(true);

      if (!selectedTemplate.isUMLDiagram && selectedTemplate.diagramType === 'QuantumCircuitDiagram') {
        await dispatch(updateQuantumDiagramThunk({ model: selectedTemplate.diagram as QuantumCircuitData }));
        await dispatch(switchDiagramTypeThunk({ diagramType: 'QuantumCircuitDiagram' }));
        navigate('/');
      } else {
        const umlType = selectedTemplate.diagramType as UMLDiagramType;
        const supportedType = toSupportedDiagramType(umlType);

        if (mode === 'new_tab' && currentProject) {
          // Create a new tab, then write the template into it
          const addResult = await dispatch(addDiagramThunk({
            diagramType: supportedType,
            title: selectedTemplate.type,
          })).unwrap();

          ProjectStorageRepository.updateDiagram(currentProject.id, supportedType, {
            ...addResult.diagram,
            title: selectedTemplate.type,
            model: selectedTemplate.diagram as any,
            lastUpdate: new Date().toISOString(),
          }, addResult.index);

          await dispatch(switchDiagramTypeThunk({ diagramType: umlType }));
          await dispatch(switchDiagramIndexThunk({ diagramType: supportedType, index: addResult.index }));
        } else if (currentProject) {
          // Replace the active diagram
          const existingDiagram = getActiveDiagram(currentProject, supportedType);
          ProjectStorageRepository.updateDiagram(currentProject.id, supportedType, {
            ...existingDiagram,
            title: selectedTemplate.type,
            model: selectedTemplate.diagram as any,
            lastUpdate: new Date().toISOString(),
          });
          await dispatch(switchDiagramTypeThunk({ diagramType: umlType }));
        }

        navigate('/');
      }

      toast.success(`Loaded template: ${selectedTemplate.type}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to load template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border/70 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="size-5 text-brand" />
            Load Template
          </DialogTitle>
          <DialogDescription>
            Start from ready-made UML, agent, state machine, and quantum templates.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[72vh] grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-2 border-b border-border/70 p-4 md:border-b-0 md:border-r">
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={[
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all',
                    isActive
                      ? 'border-brand/30 bg-brand/10 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-brand/[0.04] hover:text-foreground',
                  ].join(' ')}
                >
                  <span>{category}</span>
                  <Badge className={categoryColor[category]}>{templates.filter((template) => template.softwarePatternCategory === category).length}</Badge>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 p-4">
            <div className="h-[56vh] overflow-y-auto pr-2">
              <div className="grid gap-3 md:grid-cols-2">
                {templatesInCategory.map((template) => {
                  const selected = selectedTemplate?.type === template.type;
                  return (
                    <Card
                      key={template.type}
                      className={[
                        'cursor-pointer border transition-all',
                        selected ? 'border-brand/30 bg-brand/[0.05] shadow-sm' : 'hover:border-border/90 hover:bg-brand/[0.04]',
                      ].join(' ')}
                      onClick={() => setSelectedTemplateType(template.type)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span>{template.type}</span>
                          {selected && <Check className="size-4 text-brand" />}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Layers className="size-3.5" />
                          <span>{String(template.diagramType).replace('Diagram', ' Diagram')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/70 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleLoadClick} disabled={!selectedTemplate || isLoading} className="bg-brand text-brand-foreground hover:bg-brand-dark">
                {isLoading ? 'Loading...' : 'Load Template'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Existing diagram detected
            </DialogTitle>
            <DialogDescription>
              You already have a{' '}
              <strong>{selectedTemplate?.diagramType?.replace('Diagram', ' Diagram')}</strong>.
              How would you like to load the template?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={() => doLoadTemplate('new_tab')}>
              <Layers className="mr-1.5 size-3.5" />
              New tab
            </Button>
            <Button size="sm" onClick={() => doLoadTemplate('replace')} className="bg-brand text-brand-foreground hover:bg-brand-dark">
              Replace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
