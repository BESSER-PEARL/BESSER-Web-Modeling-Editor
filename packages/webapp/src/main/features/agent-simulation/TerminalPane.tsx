import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { useAppSelector } from '@/main/app/store/hooks';
import { selectStdoutLines } from '@/main/features/agent-simulation';

const MAX_DISPLAY_LINES = 2000;

interface TerminalPaneProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ isCollapsed, onToggleCollapse }) => {
  const { t } = useTranslation();
  const lines = useAppSelector(selectStdoutLines);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new lines arrive and pane is expanded
  useEffect(() => {
    const body = bodyRef.current;
    if (!isCollapsed && body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [lines, isCollapsed]);

  const displayedLines = lines.slice(-MAX_DISPLAY_LINES);

  return (
    <div className="shrink-0 flex flex-col border-t border-border/50">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center justify-between bg-muted px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? t('agentSimulation.terminal.expand') : t('agentSimulation.terminal.collapse')}
      >
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-brand" />
          <span className="text-xs font-medium">{t('agentSimulation.terminal.header')}</span>
          {isCollapsed && lines.length > 0 && (
            <span className="rounded-full bg-border px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              {lines.length}
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>

      {/* Terminal body */}
      {!isCollapsed && (
        <div ref={bodyRef} className="h-48 overflow-y-auto bg-background p-2 font-mono">
          {displayedLines.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">{t('agentSimulation.terminal.empty')}</p>
          ) : (
            displayedLines.map((line, index) => {
              const isError =
                /error|exception|traceback|critical/i.test(line);
              return (
                <div
                  key={index}
                  className={`whitespace-pre-wrap break-all text-[11px] leading-snug ${
                    isError
                      ? 'text-destructive'
                      : 'text-brand'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
