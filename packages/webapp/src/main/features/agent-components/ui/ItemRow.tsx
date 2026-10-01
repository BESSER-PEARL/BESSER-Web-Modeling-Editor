import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ItemRowProps {
  name: string;
  badge?: string;
  extraBadge?: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

/** A collapsible list row with a name, optional badges and a remove button. */
export function ItemRow({ name, badge, extraBadge, expanded, onToggle, onDelete, children }: ItemRowProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border bg-background">
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {name || <span className="text-muted-foreground italic">{t('agentComponents.unnamed')}</span>}
          </span>
          {badge && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
              {badge}
            </Badge>
          )}
          {extraBadge && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
              {extraBadge}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t('agentComponents.remove')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border/60 px-4 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
