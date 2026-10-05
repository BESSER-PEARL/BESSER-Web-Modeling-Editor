import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bot, FlaskConical, Folder, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/main/app/store/hooks';
import {
  selectAgentSimulationError,
  selectAgentSimulationStatus,
  selectCurrentAgentState,
  selectLastTransition,
  selectStdoutLines,
  stopAgentSimulationThunk,
  restartAgentSimulationThunk,
} from '@/main/features/agent-simulation';
import { BafChatWrapper } from './BafChatWrapper';
import { TerminalPane } from './TerminalPane';
import { AgentFileExplorer } from './AgentFileExplorer';
import { AgentDiagramReadOnly } from './AgentDiagramReadOnly';

type LeftTab = 'diagram' | 'code';

const MIN_RIGHT_WIDTH = 300;
const MAX_RIGHT_WIDTH = 1400;
const RESIZE_STEP = 40;
const LEFT_TABS: LeftTab[] = ['diagram', 'code'];

interface AgentSimulationPanelProps {
  open: boolean;
  diagramTitle: string;
}

export const AgentSimulationPanel: React.FC<AgentSimulationPanelProps> = ({ open, diagramTitle }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAgentSimulationStatus);
  const currentState = useAppSelector(selectCurrentAgentState);
  const lastTransition = useAppSelector(selectLastTransition);
  const error = useAppSelector(selectAgentSimulationError);
  const stdoutLines = useAppSelector(selectStdoutLines);

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

  const handleStop = () => dispatch(stopAgentSimulationThunk());
  const handleReset = () => dispatch(restartAgentSimulationThunk());

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = LEFT_TABS[(LEFT_TABS.indexOf(leftTab) + 1) % LEFT_TABS.length];
    setLeftTab(next);
    document.getElementById(`agent-sim-tab-${next}`)?.focus();
  };

  // The handle sits left of the chat panel, so ArrowLeft widens it.
  const handleResizeKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowLeft' ? RESIZE_STEP : e.key === 'ArrowRight' ? -RESIZE_STEP : 0;
    if (!delta) return;
    e.preventDefault();
    setRightWidth((w) => Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, w + delta)));
  };

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
          {t('agentSimulation.panel.header', { title: diagramTitle })}
        </h1>

        {status === 'starting' && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}

        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={handleStop}
          title={t('agentSimulation.panel.stop')}
          aria-label={t('agentSimulation.panel.stop')}
        >
          <X className="size-4" />
        </Button>
      </header>

      {/* Error banner */}
      {status === 'error' && error && (
        <div className="flex shrink-0 items-start gap-2.5 border-b border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-destructive">{t('agentSimulation.panel.errorTitle')}</span>
            <span className="text-xs text-foreground/80">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleStop}
          >
            {t('common.close')}
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left panel — diagram / code tabs */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border/40 px-3">
            <div role="tablist" className="flex items-center gap-1" onKeyDown={handleTabKeyDown}>
            <button
              type="button"
              role="tab"
              id="agent-sim-tab-diagram"
              aria-selected={leftTab === 'diagram'}
              aria-controls="agent-sim-tabpanel"
              tabIndex={leftTab === 'diagram' ? 0 : -1}
              className={[
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                leftTab === 'diagram'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
              onClick={() => setLeftTab('diagram')}
            >
              <Bot className="size-3.5" />
              {t('agentSimulation.panel.tabDiagram')}
            </button>
            <button
              type="button"
              role="tab"
              id="agent-sim-tab-code"
              aria-selected={leftTab === 'code'}
              aria-controls="agent-sim-tabpanel"
              tabIndex={leftTab === 'code' ? 0 : -1}
              className={[
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                leftTab === 'code'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
              onClick={() => setLeftTab('code')}
            >
              <Folder className="size-3.5" />
              {t('agentSimulation.panel.tabSource')}
            </button>
            </div>

            {/* Right side: Reset button + status badges */}
            <div className="ml-auto flex items-center gap-2 py-1">
              {lastTransition && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-1 shadow-sm">
                  <span className="text-xs text-muted-foreground">{t('agentSimulation.panel.lastTransition')}</span>
                  <span className="text-xs font-medium">{lastTransition}</span>
                </div>
              )}
              {!currentState && !lastTransition && status === 'starting' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('agentSimulation.panel.starting')}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                // A second restart while one is starting would orphan a session.
                disabled={status === 'starting'}
                title={t('agentSimulation.panel.restart')}
              >
                <RotateCcw className="size-3.5" />
                {t('agentSimulation.panel.reset')}
              </Button>
            </div>
          </div>

          {/* Tab content */}
          <div
            id="agent-sim-tabpanel"
            role="tabpanel"
            aria-labelledby={`agent-sim-tab-${leftTab}`}
            className="flex min-h-0 flex-1 overflow-hidden p-4"
          >
            {leftTab === 'diagram' ? (
              <AgentDiagramReadOnly currentState={currentState} />
            ) : (
              <AgentFileExplorer />
            )}
          </div>
        </div>

        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('agentSimulation.panel.resizeChat')}
          aria-valuenow={rightWidth}
          aria-valuemin={MIN_RIGHT_WIDTH}
          aria-valuemax={MAX_RIGHT_WIDTH}
          tabIndex={0}
          className="group relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/30 transition-colors hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none active:bg-primary/60"
          onMouseDown={handleDragStart}
          onKeyDown={handleResizeKeyDown}
          title={t('agentSimulation.panel.dragToResize')}
        >
          {/* Visual grip dots */}
          <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60">
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
          {(status === 'starting' || (status === 'running' && stdoutLines.length === 0)) && (
            <div className="flex shrink-0 items-center justify-center gap-2 border-y border-border/50 bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              {t('agentSimulation.panel.loading')}
            </div>
          )}
          <TerminalPane
            isCollapsed={isTerminalCollapsed}
            onToggleCollapse={() => setIsTerminalCollapsed((prev) => !prev)}
          />
        </div>
      </div>
    </div>
  );
};
