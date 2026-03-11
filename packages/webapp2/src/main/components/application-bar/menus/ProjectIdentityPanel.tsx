import React from 'react';
import { FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface ProjectIdentityPanelProps {
  topPanelClass: string;
  topPanelIconClass: string;
  diagramBadgeClass: string;
  projectNameDraft: string;
  diagramTitleDraft: string;
  currentDiagramType?: string;
  onProjectNameDraftChange: (value: string) => void;
  onProjectRename: () => void;
  onDiagramTitleDraftChange: (value: string) => void;
  onDiagramRename: () => void;
}

export const ProjectIdentityPanel: React.FC<ProjectIdentityPanelProps> = ({
  topPanelClass,
  topPanelIconClass,
  diagramBadgeClass,
  projectNameDraft,
  diagramTitleDraft,
  currentDiagramType,
  onProjectNameDraftChange,
  onProjectRename,
  onDiagramTitleDraftChange,
  onDiagramRename,
}) => {
  return (
    <div className={`hidden items-center gap-2 rounded-xl border px-3 py-2 lg:flex ${topPanelClass}`}>
      <FolderKanban className={`h-4 w-4 ${topPanelIconClass}`} />
      <Input
        value={projectNameDraft}
        onChange={(event) => onProjectNameDraftChange(event.target.value)}
        onBlur={onProjectRename}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className="h-7 w-40 border-none bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
        placeholder="Project name"
      />
      <span className="h-5 w-px bg-[#397C95]/20 dark:bg-[#5BB8D4]/20" />
      <Input
        value={diagramTitleDraft}
        onChange={(event) => onDiagramTitleDraftChange(event.target.value)}
        onBlur={onDiagramRename}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className="h-7 w-44 border-none bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
        placeholder="Diagram title"
      />
      <Badge variant="secondary" className={diagramBadgeClass}>
        {currentDiagramType?.replace('Diagram', '') ?? 'No Diagram'}
      </Badge>
    </div>
  );
};
