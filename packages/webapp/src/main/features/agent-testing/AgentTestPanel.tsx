import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, FlaskConical, Folder, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/main/app/store/hooks';
import {
  selectAgentTestError,
  selectAgentTestStatus,
  selectCurrentAgentState,
  selectLastTransition,
  stopAgentTestThunk,
  restartAgentTestThunk,
} from '@/main/features/agent-testing';
import { BafChatWrapper } from './BafChatWrapper';
import { TerminalPane } from './TerminalPane';
import { AgentFileExplorer } from './AgentFileExplorer';
import { AgentDiagramReadOnly } from './AgentDiagramReadOnly';

type LeftTab = 'diagram' | 'code';

const MIN_RIGHT_WIDTH = 300;
const MAX_RIGHT_WIDTH = 1400;

interface AgentTestPanelProps {
  open: boolean;
  diagramTitle: string;
}

export const AgentTestPanel: React.FC<AgentTestPanelProps> = ({ open, diagramTitle }) => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAgentTestStatus);
  const currentState = useAppSelector(selectCurrentAgentState);
  const lastTransition = useAppSelector(selectLastTransition);
  const error = useAppSelector(selectAgentTestError);

  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(true);
  const [rightWidth, setRightWidth] = useState(() => Math.max(MIN_RIGHT_WIDTH, Math.floor(window.innerWidth * 0.5)));
  const [leftTab, setLeftTab] = useState<LeftTab>('diagram');

  // Drag-to-resize state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      setRightWidth(Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, dragStartWidth.current + delta)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (!open) return null;

  const handleStop = () => dispatch(stopAgentTestThunk());
  const handleReset = () => dispatch(restartAgentTestThunk());

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-card px-4 py-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/10">
          <FlaskConical className="size-4" />
        </div>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          Testing: {diagramTitle}
        </h1>

        {status === 'starting' && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}

        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={handleStop}
          title="Stop test session"
          aria-label="Stop test session"
        >
          <X className="size-4" />
        </Button>
      </header>

      {/* Error banner */}
      {status === 'error' && error && (
        <div className="flex shrink-0 items-start gap-2.5 border-b border-red-200/60 bg-red-50/80 px-4 py-3 dark:border-red-800/40 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-red-800 dark:text-red-200">Test session error</span>
            <span className="text-xs text-red-700 dark:text-red-300">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400"
            onClick={handleStop}
          >
            Close
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left panel — diagram / code tabs */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border/40 px-3">
            <button
              className={[
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                leftTab === 'diagram'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
              onClick={() => setLeftTab('diagram')}
            >
              <Bot className="size-3.5" />
              Diagram
            </button>
            <button
              className={[
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                leftTab === 'code'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
              onClick={() => setLeftTab('code')}
            >
              <Folder className="size-3.5" />
              Source
            </button>

            {/* Right side: Reset button + status badges */}
            <div className="ml-auto flex items-center gap-2 py-1">
              {lastTransition && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-1 shadow-sm">
                  <span className="text-xs text-muted-foreground">Last transition:</span>
                  <span className="text-xs font-medium">{lastTransition}</span>
                </div>
              )}
              {!currentState && !lastTransition && status === 'starting' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Starting agent session…
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                title="Restart agent session"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex min-h-0 flex-1 overflow-hidden p-4">
            {leftTab === 'diagram' ? (
              <AgentDiagramReadOnly currentState={currentState} />
            ) : (
              <AgentFileExplorer />
            )}
          </div>
        </div>

        {/* Drag handle */}
        <div
          className="group relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/30 transition-colors hover:bg-primary/40 active:bg-primary/60"
          onMouseDown={handleDragStart}
          title="Drag to resize"
        >
          {/* Visual grip dots */}
          <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-60">
            {[0, 1, 2].map((i) => (
              <div key={i} className="size-1 rounded-full bg-foreground" />
            ))}
          </div>
        </div>

        {/* Right panel — chat + terminal */}
        <div
          className="flex shrink-0 flex-col overflow-hidden border-l border-border/50"
          style={{ width: rightWidth }}
        >
          <BafChatWrapper />
          <TerminalPane
            isCollapsed={isTerminalCollapsed}
            onToggleCollapse={() => setIsTerminalCollapsed((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
};
