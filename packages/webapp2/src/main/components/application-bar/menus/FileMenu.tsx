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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title="File">
          <FileText className="h-4 w-4" />
          <span className="hidden xl:inline">File</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenProjectHub}>New / Open Project</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenProjectHub}>Import Project</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenTemplateDialog}>Load Template</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportProject}>Export Project</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onImportSingleDiagram} disabled={!hasProject}>
          Import Single Diagram to Project
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!hasProject}>Import Class Diagram from</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={onOpenAssistantImportImage}>Image to Project</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenAssistantImportKg}>KG to Project</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onOpenProjectPreview} disabled={!hasProject}>
          Preview Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
