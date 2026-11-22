import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { selectProject, setPerspectiveEnabledThunk } from '../../app/store/workspaceSlice';
import { HeaderTooltip } from '../../app/shell/menus/HeaderTooltip';
import { isPerspectiveVisible, type SupportedDiagramType } from '../../shared/types/project';
import { countUnread, markAllSeen, WHATS_NEW } from './whatsNew';
import { track } from '../../shared/services/analytics/events';

interface WhatsNewMenuProps {
  outlineButtonClass: string;
  onSwitchDiagramType: (type: SupportedDiagramType) => void;
}

/**
 * Top-bar "What's new": a dot until the user opens it after a release, and an
 * entry for a new diagram type opens that editor, first showing it in the
 * sidebar if the project hides it (older projects get new types hidden).
 */
export const WhatsNewMenu: React.FC<WhatsNewMenuProps> = ({ outlineButtonClass, onSwitchDiagramType }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectProject);
  const [unread, setUnread] = useState(() => countUnread(WHATS_NEW));
  // Entries that were new when the panel opened keep their badge while it stays open.
  const [highlighted, setHighlighted] = useState(0);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }),
    [i18n.language],
  );

  const title = t('whatsNew.title');
  const triggerLabel = unread > 0 ? t('whatsNew.unread', { count: unread }) : title;

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    track('ui_action', { action: 'whats_new_opened', unread_count: unread });
    if (unread === 0) return;
    setHighlighted(unread);
    markAllSeen(WHATS_NEW);
    setUnread(0);
  };

  const openDiagram = async (type: SupportedDiagramType, entryId: string) => {
    track('ui_action', { action: 'whats_new_entry_opened', entry_id: entryId, diagram_type: type });
    if (!isPerspectiveVisible(project?.settings?.perspectives, type)) {
      await dispatch(setPerspectiveEnabledThunk({ type, enabled: true }));
    }
    onSwitchDiagramType(type);
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <HeaderTooltip label={triggerLabel}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`relative px-2.5 ${outlineButtonClass}`} aria-label={triggerLabel}>
            <Sparkles className="size-4" aria-hidden="true" />
            {unread > 0 && (
              <span
                aria-hidden="true"
                data-testid="whats-new-dot"
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-background"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
      </HeaderTooltip>
      <DropdownMenuContent className="w-80 p-0" align="end">
        <DropdownMenuLabel className="px-4 pb-2 pt-3 text-sm font-semibold">{title}</DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[70vh] overflow-y-auto py-1">
          {WHATS_NEW.map((entry, index) => (
            <section key={entry.id} aria-labelledby={`whats-new-${entry.id}`} className="px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>v{entry.version}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={entry.date}>{dateFormat.format(new Date(`${entry.date}T12:00:00`))}</time>
                {index < highlighted && (
                  <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    {t('whatsNew.new')}
                  </span>
                )}
              </p>
              <h3 id={`whats-new-${entry.id}`} className="mt-1 text-sm font-semibold text-foreground">
                {t(`whatsNew.entries.${entry.id}.title`)}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t(`whatsNew.entries.${entry.id}.body`)}
              </p>
              {entry.diagramType && project && (
                <DropdownMenuItem
                  className="-mx-2 mt-1.5 w-fit gap-1.5 font-medium text-brand focus:text-brand"
                  onSelect={() => void openDiagram(entry.diagramType!, entry.id)}
                >
                  {t(`whatsNew.entries.${entry.id}.action`)}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </DropdownMenuItem>
              )}
            </section>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
