import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  Download,
  Eye,
  FileInput,
  FileJson,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Github,
  Image,
  LayoutTemplate,
  Share2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SupportedDiagramType } from '../../../shared/types/project';
import { HeaderTooltip } from './HeaderTooltip';

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

const groupLabelClass = 'px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground';

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
  const title = t('menu.file.title');
  return (
    <DropdownMenu>
      <HeaderTooltip label={title} hideFrom="xl">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`gap-2 ${outlineButtonClass}`} aria-label={title}>
            <FileText className="size-4" aria-hidden="true" />
            <span className="hidden xl:inline">{title}</span>
            <ChevronDown className="hidden size-3 opacity-50 md:block" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </HeaderTooltip>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuItem onClick={() => onOpenProjectHub('create')}>
          <FilePlus className="mr-2 size-4" />
          {t('menu.file.newProject')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenProjectHub('open')}>
          <FolderOpen className="mr-2 size-4" />
          {t('menu.file.openProject')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Upload className="mr-2 size-4" />
            {t('menu.file.import')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className={groupLabelClass}>
                {t('menu.file.importGroupProject', { defaultValue: 'Project' })}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onOpenProjectHub('import')}>
                <FileJson className="mr-2 size-4" />
                {t('menu.file.importProjectFile')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenProjectHub('spreadsheet')}>
                <FileSpreadsheet className="mr-2 size-4" />
                {t('menu.file.fromSpreadsheet')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenProjectHub('github')}>
                <Github className="mr-2 size-4" />
                {t('menu.file.fromGithub')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={groupLabelClass}>
                {t('menu.file.importGroupClassDiagram', { defaultValue: 'Class Diagram from' })}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenAssistantImportImage} disabled={!hasProject}>
                <Image className="mr-2 size-4" />
                {t('menu.file.importImage', { defaultValue: 'Image…' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenAssistantImportKg} disabled={!hasProject}>
                <Share2 className="mr-2 size-4" />
                {t('menu.file.importKnowledgeGraph', { defaultValue: 'Knowledge Graph…' })}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenTemplateDialog}>
          <LayoutTemplate className="mr-2 size-4" />
          {t('menu.file.loadTemplate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportProject}>
          <Download className="mr-2 size-4" />
          {t('menu.file.exportProject')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem onClick={onImportSingleDiagram} disabled={!hasProject}>
          Import Single Diagram to Project
        </DropdownMenuItem> */}
        {activeDiagramType === 'BPMN' && (
          <DropdownMenuItem onClick={onImportBpmnDiagram} disabled={!hasProject}>
            <FileInput className="mr-2 size-4" />
            {t('menu.file.importBpmnDiagram')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenProjectPreview} disabled={!hasProject}>
          <Eye className="mr-2 size-4" />
          {t('menu.file.previewProject')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
