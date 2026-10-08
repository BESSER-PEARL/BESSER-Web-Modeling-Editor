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
      <div className="flex items-center justify-between pr-3 hover:bg-muted/30 transition-colors">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 min-w-0 rounded-md py-2.5 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
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
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t('agentComponents.remove')}
          aria-label={name ? `${t('agentComponents.remove')}: ${name}` : t('agentComponents.remove')}
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
