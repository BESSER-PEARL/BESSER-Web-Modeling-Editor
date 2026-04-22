import React from 'react';
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
  onOpenProjectHub: () => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onImportSingleDiagram: () => void;
  onOpenAssistantImportImage: () => void;
  onOpenAssistantImportKg: () => void;
  onImportOwl: () => void;
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
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onImportOwl,
  onOpenProjectPreview,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title="File">
          <FileText className="size-4" />
          <span className="hidden xl:inline">File</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenProjectHub}>New / Open / Import Project</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenTemplateDialog}>Load Template</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportProject}>Export Project</DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem onClick={onImportSingleDiagram} disabled={!hasProject}>
          Import Single Diagram to Project
        </DropdownMenuItem> */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!hasProject}>Import Class Diagram from</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={onOpenAssistantImportImage}>Image to Project</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenAssistantImportKg}>KG to Project</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {activeDiagramType === 'KnowledgeGraphDiagram' && (
          <DropdownMenuItem onClick={onImportOwl} disabled={!hasProject}>
            Import KG (OWL)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenProjectPreview} disabled={!hasProject}>
          Preview Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
