import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { useAppSelector } from '@/main/app/store/hooks';
import { selectStdoutLines } from '@/main/features/agent-testing';

const MAX_DISPLAY_LINES = 2000;

interface TerminalPaneProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ isCollapsed, onToggleCollapse }) => {
  const lines = useAppSelector(selectStdoutLines);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new lines arrive and pane is expanded
  useEffect(() => {
    if (!isCollapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, isCollapsed]);

  const displayedLines = lines.slice(-MAX_DISPLAY_LINES);

  return (
    <div className="shrink-0 flex flex-col border-t border-border/50">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center justify-between bg-gray-100 px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Expand terminal' : 'Collapse terminal'}
      >
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-teal-600 dark:text-green-400" />
          <span className="text-xs font-medium">Agent Output</span>
          {isCollapsed && lines.length > 0 && (
            <span className="rounded-full bg-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
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
        <div className="h-48 overflow-y-auto bg-gray-50 p-2 font-mono dark:bg-gray-950">
          {displayedLines.length === 0 ? (
            <p className="text-[11px] italic text-gray-400 dark:text-gray-600">No output yet…</p>
          ) : (
            displayedLines.map((line, index) => {
              const isError =
                /error|exception|traceback|critical/i.test(line);
              return (
                <div
                  key={index}
                  className={`whitespace-pre-wrap break-all text-[11px] leading-snug ${
                    isError
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-teal-700 dark:text-green-400'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
