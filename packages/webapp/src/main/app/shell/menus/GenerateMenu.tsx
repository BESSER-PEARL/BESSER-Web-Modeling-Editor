import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Code2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GENERATOR_MENU_CONFIG, GeneratorMenuEntry } from './generator-menu-config';
import type { GeneratorMenuMode, GeneratorType } from '../workspace-types';
import type { SupportedDiagramType } from '../../../shared/types/project';

interface GenerateMenuProps {
  mode: GeneratorMenuMode;
  isGenerating: boolean;
  primaryGenerateClass: string;
  activeDiagramType: SupportedDiagramType;
  onGenerate: (type: GeneratorType, config?: Record<string, any>) => void;
  onSwitchDiagramType?: (type: SupportedDiagramType) => void;
}

const renderGeneratorMenuEntry = (
  entry: GeneratorMenuEntry,
  onGenerate: (type: GeneratorType, config?: Record<string, any>) => void,
  t: TFunction,
) => {
  if (entry.kind === 'group') {
    return (
      <DropdownMenuSub key={entry.label}>
        <DropdownMenuSubTrigger>{entry.labelKey ? t(entry.labelKey) : entry.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {entry.actions.map((action) => (
            <DropdownMenuItem key={action.generator} onClick={() => onGenerate(action.generator, action.config)}>
              {action.labelKey ? t(action.labelKey) : action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  if (entry.kind === 'notice') {
    return (
      <DropdownMenuItem key={entry.label} disabled>
        {entry.labelKey ? t(entry.labelKey) : entry.label}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem key={entry.generator} onClick={() => onGenerate(entry.generator, entry.config)}>
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
}) => {
  const { t } = useTranslation();
  const menuEntries = GENERATOR_MENU_CONFIG[mode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={primaryGenerateClass}
          disabled={isGenerating}
          title={t('menu.generate.title')}
        >
          <Code2 className="size-4" />
          <span className="hidden xl:inline">
            {isGenerating ? t('menu.generate.generating') : t('menu.generate.title')}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>{t('menu.generate.codeGeneration')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuEntries.map((entry) => renderGeneratorMenuEntry(entry, onGenerate, t))}
        {mode === 'statemachine' && onSwitchDiagramType && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSwitchDiagramType('ClassDiagram')}>
              {t('menu.generate.goToClassDiagram')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
