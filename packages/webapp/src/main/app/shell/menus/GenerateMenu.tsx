import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  AppWindow,
  ArrowRight,
  Atom,
  Bot,
  Boxes,
  Braces,
  Brain,
  ChevronDown,
  Code2,
  Coffee,
  Component,
  Container,
  Database,
  FileCode2,
  FileJson,
  FlaskConical,
  Globe,
  Info,
  Layers,
  Loader2,
  type LucideIcon,
  Network,
  Server,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GENERATOR_MENU_CONFIG, GeneratorMenuEntry } from './generator-menu-config';
import type { GeneratorMenuMode, GeneratorType } from '../workspace-types';
import type { SupportedDiagramType } from '../../../shared/types/project';
import { HeaderTooltip } from './HeaderTooltip';
import { SUBMENU_OFFSETS } from './FileMenu';

interface GenerateMenuProps {
  mode: GeneratorMenuMode;
  isGenerating: boolean;
  primaryGenerateClass: string;
  activeDiagramType?: SupportedDiagramType;
  onGenerate: (type: GeneratorType, config?: Record<string, any>) => void;
  onSwitchDiagramType?: (type: SupportedDiagramType) => void;
  onDeriveComponentDiagram?: () => void;
  onDeriveDeploymentDiagram?: () => void;
  onGenerateDockerCompose?: () => void;
}

/** Icons for top-level groups, keyed by the config's stable English label. */
const GROUP_ICONS: Record<string, LucideIcon> = {
  Web: Globe,
  Database,
  OOP: Boxes,
  Testing: FlaskConical,
  Schema: FileJson,
  Data: Braces,
  PyTorch: Brain,
  TensorFlow: Brain,
};

/** Leaf icons, so generator items match File > Import's iconned leaves. */
const GENERATOR_ICONS: Partial<Record<GeneratorType, LucideIcon>> = {
  django: Server,
  spring: Server,
  backend: Server,
  web_app: AppWindow,
  sql: Database,
  supabase: Database,
  sqlalchemy: Database,
  python: FileCode2,
  java: Coffee,
  test_case: FlaskConical,
  pydantic: Braces,
  jsonschema: FileJson,
  smartdata: FileJson,
  jsonobject: FileJson,
  agent: Bot,
  qiskit: Atom,
  bpmn: Workflow,
  pytorch: Layers,
  tensorflow: Layers,
};

const renderGeneratorMenuEntry = (
  entry: GeneratorMenuEntry,
  onGenerate: (type: GeneratorType, config?: Record<string, any>) => void,
  t: TFunction,
) => {
  if (entry.kind === 'group') {
    const GroupIcon = GROUP_ICONS[entry.label] ?? Code2;
    return (
      <DropdownMenuSub key={entry.label}>
        <DropdownMenuSubTrigger>
          <GroupIcon className="mr-2 size-4" />
          {entry.labelKey ? t(entry.labelKey) : entry.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent {...SUBMENU_OFFSETS}>
          {entry.actions.map((action) => {
            const ActionIcon = GENERATOR_ICONS[action.generator] ?? Code2;
            return (
              <DropdownMenuItem
                key={`${action.generator}-${action.label}`}
                onClick={() => onGenerate(action.generator, action.config)}
              >
                <ActionIcon className="mr-2 size-4" />
                {action.labelKey ? t(action.labelKey) : action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  if (entry.kind === 'notice') {
    return (
      <DropdownMenuItem key={entry.label} disabled className="items-start">
        <Info className="mr-2 mt-0.5 size-4 shrink-0" />
        {entry.labelKey ? t(entry.labelKey) : entry.label}
      </DropdownMenuItem>
    );
  }

  const EntryIcon = GENERATOR_ICONS[entry.generator] ?? Code2;
  return (
    <DropdownMenuItem key={entry.generator} onClick={() => onGenerate(entry.generator, entry.config)}>
      <EntryIcon className="mr-2 size-4" />
      {entry.labelKey ? t(entry.labelKey) : entry.label}
    </DropdownMenuItem>
  );
};

export const GenerateMenu: React.FC<GenerateMenuProps> = ({
  mode,
  isGenerating,
  primaryGenerateClass,
  activeDiagramType,
  onGenerate,
  onSwitchDiagramType,
  onDeriveComponentDiagram,
  onDeriveDeploymentDiagram,
  onGenerateDockerCompose,
}) => {
  const { t } = useTranslation();
  const menuEntries = GENERATOR_MENU_CONFIG[mode];
  const label = isGenerating ? t('menu.generate.generating') : t('menu.generate.title');

  return (
    <DropdownMenu>
      <HeaderTooltip label={label} hideFrom="lg">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={primaryGenerateClass}
            disabled={isGenerating}
            aria-busy={isGenerating || undefined}
            aria-label={label}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Code2 className="size-4" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">{label}</span>
            <ChevronDown className="hidden size-3 opacity-50 md:block" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </HeaderTooltip>
      <DropdownMenuContent className="w-72" align="end">
        {menuEntries.map((entry) => renderGeneratorMenuEntry(entry, onGenerate, t))}
        {mode === 'statemachine' && onSwitchDiagramType && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSwitchDiagramType('ClassDiagram')}>
              <ArrowRight className="mr-2 size-4" />
              {t('menu.generate.goToClassDiagram')}
            </DropdownMenuItem>
          </>
        )}
        {activeDiagramType === 'BPMN' && onDeriveComponentDiagram && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDeriveComponentDiagram()}>
              <Component className="mr-2 size-4" />
              {t('menu.generate.deriveComponentDiagram')}
            </DropdownMenuItem>
          </>
        )}
        {activeDiagramType === 'ComponentDiagram' && onDeriveDeploymentDiagram && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDeriveDeploymentDiagram}>
              <Network className="mr-2 size-4" />
              {t('menu.generate.deriveDeploymentDiagram')}
            </DropdownMenuItem>
          </>
        )}
        {activeDiagramType === 'DeploymentDiagram' && onGenerateDockerCompose && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onGenerateDockerCompose}>
              <Container className="mr-2 size-4" />
              {t('menu.generate.generateDockerCompose')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
