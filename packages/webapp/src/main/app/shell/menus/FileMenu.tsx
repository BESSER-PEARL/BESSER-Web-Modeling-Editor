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

interface FileMenuProps {
  outlineButtonClass: string;
  hasProject: boolean;
  onOpenProjectHub: () => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onImportSingleDiagram: () => void;
  onOpenAssistantImportImage: () => void;
  onOpenAssistantImportKg: () => void;
  onOpenProjectPreview: () => void;
}

export const FileMenu: React.FC<FileMenuProps> = ({
  outlineButtonClass,
  hasProject,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onImportSingleDiagram,
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
        <DropdownMenuItem onClick={onOpenProjectHub}>{t('menu.file.newOpenImport')}</DropdownMenuItem>
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
        <DropdownMenuItem onClick={onOpenProjectPreview} disabled={!hasProject}>
          {t('menu.file.previewProject')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
