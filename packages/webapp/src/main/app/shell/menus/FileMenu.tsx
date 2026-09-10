import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ChevronDown } from 'lucide-react';
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
import type { SupportedDiagramType } from '../../../shared/types/project';

interface FileMenuProps {
  outlineButtonClass: string;
  hasProject: boolean;
  activeDiagramType: SupportedDiagramType;
  /** Opens the Project Hub; an optional step targets New / Open / Import directly. */
  onOpenProjectHub: (step?: 'create' | 'open' | 'import' | 'spreadsheet' | 'github') => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onImportSingleDiagram: () => void;
  onImportBpmnDiagram: () => void;
  onOpenAssistantImportImage: () => void;
  onOpenAssistantImportKg: () => void;
  onOpenProjectPreview: () => void;
}

export const FileMenu: React.FC<FileMenuProps> = ({
  outlineButtonClass,
  hasProject,
  activeDiagramType,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onImportSingleDiagram,
  onImportBpmnDiagram,
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onOpenProjectPreview,
}) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title={t('menu.file.title')}>
          <FileText className="size-4" />
          <span className="hidden xl:inline">{t('menu.file.title')}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>{t('menu.file.projectActions')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onOpenProjectHub('create')}>{t('menu.file.newProject')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenProjectHub('open')}>{t('menu.file.openProject')}</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('menu.file.import')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onOpenProjectHub('import')}>{t('menu.file.importProjectFile')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenProjectHub('spreadsheet')}>{t('menu.file.fromSpreadsheet')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenProjectHub('github')}>{t('menu.file.fromGithub')}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenTemplateDialog}>{t('menu.file.loadTemplate')}</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportProject}>{t('menu.file.exportProject')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem onClick={onImportSingleDiagram} disabled={!hasProject}>
          Import Single Diagram to Project
        </DropdownMenuItem> */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!hasProject}>{t('menu.file.importClassDiagramFrom')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={onOpenAssistantImportImage}>{t('menu.file.imageToProject')}</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenAssistantImportKg}>{t('menu.file.kgToProject')}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {activeDiagramType === 'BPMN' && (
          <DropdownMenuItem onClick={onImportBpmnDiagram} disabled={!hasProject}>
            Import BPMN Diagram (.bpmn / .xml)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenProjectPreview} disabled={!hasProject}>
          {t('menu.file.previewProject')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
