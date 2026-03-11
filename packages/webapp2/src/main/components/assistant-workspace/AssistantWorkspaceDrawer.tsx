/**
 * AssistantWorkspaceDrawer — bottom-sheet style drawer that delegates all
 * assistant business logic to the shared useAssistantLogic hook.
 *
 * Owns only the drag-to-open/close gesture, layout animation, and rendering.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, MessageSquarePlus } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';
import { useAssistantLogic, type ConnectionStatus } from './useAssistantLogic';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface AssistantWorkspaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerGenerator?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
  onSwitchDiagram?: (diagramType: string) => Promise<boolean>;
}

interface DragState {
  pointerId: number;
  startY: number;
  startOffset: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: number;
}

const HANDLE_HEIGHT = 48;
const FALLBACK_CLOSED_OFFSET = -640;
const VELOCITY_SNAP_THRESHOLD = 0.35;
const POSITION_SNAP_THRESHOLD = 0.45;

/** All available starter prompts — a random subset is displayed each session. */
const ALL_STARTER_PROMPTS = [
  // Class Diagrams
  'Create an e-commerce system with customers, orders, and products',
  'Design a university enrollment system with students, courses, and professors',
  'Model a hospital management system with patients, doctors, and appointments',
  'Build a library management system with books, authors, and members',
  'Create a banking system with accounts, transactions, and customers',
  'Design a social media platform with users, posts, and comments',
  'Model a restaurant ordering system with menus, orders, and tables',
  'Create a project management tool with tasks, teams, and sprints',
  // GUI
  'Generate a web app for hotel booking',
  'Design a dashboard for inventory management',
  // Multi-diagram
  'Create a library management platform',
  'Build a complete task management application with models and UI',
];

/** Pick N random prompts from the pool, deterministic per session. */
function pickRandomPrompts(pool: string[], count: number): string[] {
  const shuffled = [...pool];
  let seed = Math.floor(Date.now() / 60_000);
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

const STARTER_PROMPTS = pickRandomPrompts(ALL_STARTER_PROMPTS, 5);

/* ------------------------------------------------------------------ */
/*  Helper functions                                                   */
/* ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const getConnectionDotClass = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
    case 'reconnecting':
    case 'closing':
      return 'bg-amber-500 animate-pulse';
    default:
      return 'bg-red-500';
  }
};

const getConnectionLabel = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting\u2026';
    case 'reconnecting':
      return 'Reconnecting\u2026';
    case 'closing':
      return 'Closing\u2026';
    case 'closed':
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AssistantWorkspaceDrawer: React.FC<AssistantWorkspaceDrawerProps> = ({
  open,
  onOpenChange,
  onTriggerGenerator,
  onSwitchDiagram,
}) => {
  /* ---- Drag gesture state ---- */

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const translateYRef = useRef(FALLBACK_CLOSED_OFFSET);

  const [drawerHeight, setDrawerHeight] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [translateY, setTranslateY] = useState(FALLBACK_CLOSED_OFFSET);

  /* ---- Drawer-specific switchDiagram: delegates to parent ---- */

  const switchDiagram = async (targetType: string): Promise<boolean> => {
    return onSwitchDiagram ? await onSwitchDiagram(targetType) : false;
  };

  /* ---- Shared assistant logic ---- */

  const {
    messages,
    inputValue,
    setInputValue,
    isGenerating,
    connectionStatus,
    rateLimitStatus,
    messageListContainerRef,
    handleSubmit,
    stopGenerating,
    clearConversation,
  } = useAssistantLogic({
    isActive: open,
    switchDiagram,
    onGenerate: onTriggerGenerator,
  });

  /* ---- Drawer measurement & animation ---- */

  const closedOffset = isMeasured && drawerHeight > 0 ? -(drawerHeight - HANDLE_HEIGHT) : FALLBACK_CLOSED_OFFSET;
  const hasConversation = messages.length > 0;

  const updateTranslateY = (nextOffset: number) => {
    if (translateYRef.current === nextOffset) return;
    translateYRef.current = nextOffset;
    setTranslateY(nextOffset);
  };

  const ensureMeasuredDrawerHeight = (): number => {
    const element = drawerRef.current;
    if (!element) return 0;
    const measuredHeight = Math.round(element.getBoundingClientRect().height);
    if (measuredHeight > 0) {
      setDrawerHeight((previous) => (previous === measuredHeight ? previous : measuredHeight));
      setIsMeasured((previous) => (previous ? previous : true));
      return measuredHeight;
    }
    return 0;
  };

  useLayoutEffect(() => {
    const element = drawerRef.current;
    if (!element) return;
    const measure = () => ensureMeasuredDrawerHeight();
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (isDragging) return;
    if (!isMeasured) {
      if (open) updateTranslateY(0);
      return;
    }
    updateTranslateY(open ? 0 : closedOffset);
  }, [closedOffset, isDragging, isMeasured, open]);

  /* ---- Escape key ---- */

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [onOpenChange, open]);

  /* ---- Drag gesture handlers ---- */

  const totalTravel = Math.max(1, 0 - closedOffset);
  const openProgress = isMeasured ? clamp((translateY - closedOffset) / totalTravel, 0, 1) : open ? 1 : 0;

  const updateDragPosition = (clientY: number) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const deps = dragDepsRef.current;
    const now = performance.now();
    const dragDistance = clientY - dragState.startY;
    const currentClosedOffset = deps.isMeasured ? deps.closedOffset : -Math.max(deps.drawerHeight, 1);
    const nextOffset = clamp(dragState.startOffset + dragDistance, currentClosedOffset, 0);
    const deltaTime = Math.max(1, now - dragState.lastTime);
    dragState.velocity = (clientY - dragState.lastY) / deltaTime;
    dragState.moved = Math.max(dragState.moved, Math.abs(dragDistance));
    dragState.lastY = clientY;
    dragState.lastTime = now;
    updateTranslateY(nextOffset);
  };

  const finishDrag = () => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const deps = dragDepsRef.current;
    if (dragHandleRef.current && dragHandleRef.current.hasPointerCapture(dragState.pointerId)) {
      try {
        dragHandleRef.current.releasePointerCapture(dragState.pointerId);
      } catch {
        // Ignore release failures.
      }
    }
    dragStateRef.current = null;
    setIsDragging(false);
    const progress = clamp((translateYRef.current - deps.closedOffset) / deps.totalTravel, 0, 1);
    let shouldOpen = progress >= POSITION_SNAP_THRESHOLD;
    if (dragState.moved < 6) {
      shouldOpen = !deps.open;
    } else if (Math.abs(dragState.velocity) > VELOCITY_SNAP_THRESHOLD) {
      shouldOpen = dragState.velocity > 0;
    }
    deps.onOpenChange(shouldOpen);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const measuredHeight = isMeasured ? drawerHeight : ensureMeasuredDrawerHeight();
    if (measuredHeight <= 0) return;
    const startOffset = open ? translateYRef.current : -(measuredHeight - HANDLE_HEIGHT);
    if (!open) updateTranslateY(startOffset);
    dragHandleRef.current = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail on some devices.
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      moved: 0,
    };
    setIsDragging(true);
  };

  // Stable refs for values used inside drag handlers — avoids re-registering
  // event listeners when only derived values change.
  const dragDepsRef = useRef({ closedOffset, totalTravel, open, onOpenChange, isMeasured, drawerHeight });
  dragDepsRef.current = { closedOffset, totalTravel, open, onOpenChange, isMeasured, drawerHeight };

  useEffect(() => {
    if (!isDragging) return;
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      updateDragPosition(event.clientY);
    };
    const onPointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      finishDrag();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [isDragging]);

  /* ---- Computed values ---- */

  const rateLimitColor =
    rateLimitStatus.cooldownRemaining > 0 || rateLimitStatus.requestsLastMinute >= 8
      ? 'text-red-500'
      : rateLimitStatus.requestsLastMinute >= 6
        ? 'text-amber-500'
        : 'text-muted-foreground';

  /* ---- Render helpers ---- */

  const renderComposer = (className: string) => (
    <ChatForm className={className} isPending={isGenerating} handleSubmit={handleSubmit}>
      {({ files, setFiles }) => (
        <MessageInput
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          allowAttachments
          files={files}
          setFiles={setFiles}
          stop={stopGenerating}
          isGenerating={isGenerating}
        />
      )}
    </ChatForm>
  );

  /* ---- Render ---- */

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-30 bg-slate-950/50 backdrop-blur-[3px] transition-opacity duration-300',
          (open || isDragging) && openProgress > 0.02 && 'pointer-events-auto',
        )}
        style={{ opacity: openProgress * 0.75 }}
        onClick={() => onOpenChange(false)}
      />

      <section
        ref={drawerRef}
        className={cn(
          'pointer-events-none absolute inset-0 z-40 flex flex-col overflow-hidden bg-transparent',
          !isDragging && 'transition-transform duration-300 ease-out',
        )}
        style={{
          transform:
            !isMeasured && !open && !isDragging
              ? `translateY(calc(-100% + ${HANDLE_HEIGHT}px))`
              : `translateY(${translateY}px)`,
        }}
        aria-hidden={!open && !isDragging}
      >
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col border-t border-border/30 bg-background pb-12 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] transition-opacity duration-300',
            (open || isDragging) ? 'pointer-events-auto' : 'pointer-events-none',
            openProgress < 0.02 && !open && !isDragging && 'opacity-0',
          )}
        >
          {!hasConversation ? (
            /* ================================================================ */
            /*  Welcome Screen — Main Landing                                    */
            /* ================================================================ */
            <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden">
              {/* Background layer */}
              <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:radial-gradient(circle,rgba(15,23,42,0.8)_0.8px,transparent_0.8px)] [background-size:20px_20px] dark:opacity-[0.04] dark:[background-image:radial-gradient(circle,rgba(148,163,184,0.5)_0.8px,transparent_0.8px)]" />
              <div className="pointer-events-none absolute -left-40 -top-20 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-teal-200/20 via-cyan-100/10 to-transparent blur-[80px] dark:from-teal-500/5 dark:via-cyan-400/3" />
              <div className="pointer-events-none absolute -bottom-20 -right-32 h-[350px] w-[350px] rounded-full bg-gradient-to-tl from-emerald-100/15 to-transparent blur-[80px] dark:from-emerald-500/4" />

              {/* Top spacer — pushes content to vertical center */}
              <div className="flex-[1_1_14%] min-h-6" />

              {/* Content column */}
              <div className="relative z-10 w-full max-w-2xl px-6 sm:px-8">

                {/* Brand mark */}
                <div className="animate-fade-up flex items-center justify-center" style={{ animationDelay: '0ms' }}>
                  <img
                    src="/images/logo.png"
                    alt="BESSER"
                    className="h-9 w-auto brightness-0 opacity-60 dark:invert sm:h-10"
                  />
                </div>

                {/* Headline */}
                <h1
                  className="animate-fade-up mt-7 text-center font-display text-[2.25rem] leading-[1.12] tracking-tight sm:text-[2.75rem] lg:text-5xl"
                  style={{ animationDelay: '70ms' }}
                >
                  What would you like to{' '}
                  <em className="font-display italic text-primary">model</em> today?
                </h1>

                {/* Subtitle + connection */}
                <p
                  className="animate-fade-up mt-4 text-center text-sm leading-relaxed text-muted-foreground sm:text-[15px]"
                  style={{ animationDelay: '130ms' }}
                >
                  Describe your system in natural language. Get diagrams, interfaces, and production code.
                  <span className="ml-2.5 inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
                    <span className="text-muted-foreground/70">{getConnectionLabel(connectionStatus)}</span>
                  </span>
                </p>

                {/* Chat input — hero element */}
                <div
                  className="animate-fade-up mt-9"
                  style={{ animationDelay: '200ms' }}
                >
                  <div className="glass-card rounded-2xl p-3 shadow-elevation-3 ring-1 ring-border/20 sm:p-4">
                    {renderComposer('w-full')}
                  </div>
                </div>

                {/* Starter prompt pills */}
                <div
                  className="animate-fade-up mt-4 flex flex-wrap justify-center gap-1.5"
                  style={{ animationDelay: '300ms' }}
                >
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputValue(prompt)}
                      className="rounded-full border border-border/40 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground/80 backdrop-blur-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/25 hover:bg-primary/4 hover:text-foreground hover:shadow-sm dark:border-slate-700/40 dark:bg-slate-900/40"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Gradient divider */}
                <div
                  className="animate-fade-up mx-auto mt-10 h-px w-full max-w-xs bg-gradient-to-r from-transparent via-border/40 to-transparent"
                  style={{ animationDelay: '380ms' }}
                />

                {/* Capability indicators — minimal, informational */}
                <div
                  className="animate-fade-up mt-7 flex items-start justify-center gap-0"
                  style={{ animationDelay: '430ms' }}
                >
                  <div className="flex-1 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">6 Diagram Types</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                      Class, Object, State Machine, Agent, GUI, Quantum
                    </p>
                  </div>
                  <div className="mx-4 mt-1 h-6 w-px bg-border/30 sm:mx-6" />
                  <div className="flex-1 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Visual Interfaces</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                      GUI screens and layouts from descriptions
                    </p>
                  </div>
                  <div className="mx-4 mt-1 h-6 w-px bg-border/30 sm:mx-6" />
                  <div className="flex-1 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Code Generation</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                      Django, React, Flutter, SQL, and 10+ targets
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom spacer + footer */}
              <div className="flex-[1_1_8%] min-h-4" />
              <p className="animate-fade-up pb-4 text-center text-[10px] text-muted-foreground/35" style={{ animationDelay: '500ms' }}>
                Press <kbd className="rounded-[3px] border border-border/30 bg-muted/25 px-1.5 py-0.5 font-mono text-[9px]">Esc</kbd> to close
              </p>
            </div>
          ) : (
            /* ================================================================ */
            /*  Chat View                                                        */
            /* ================================================================ */
            <>
              {/* Messages */}
              <div ref={messageListContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/10 via-background to-muted/5 px-4 py-6 sm:px-8">
                <div className="mx-auto w-full max-w-4xl">
                  <MessageList messages={messages} isTyping={isGenerating} showTimeStamps={false} />
                </div>
              </div>

              {/* Bottom bar */}
              <div className="shrink-0 border-t border-border/40 bg-background/85 px-4 py-3 backdrop-blur-md sm:px-8">
                <div className="mx-auto w-full max-w-4xl">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                      <span className={cn('h-1.5 w-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
                      <span className="font-medium">{getConnectionLabel(connectionStatus)}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={cn('font-mono text-[10px] tracking-wide', rateLimitColor)}>{rateLimitStatus.requestsLastMinute}/8</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 rounded-lg border-border/50 px-2.5 text-xs"
                        onClick={clearConversation}
                        title="Start a new conversation"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        New Chat
                      </Button>
                    </div>
                  </div>
                  {renderComposer('w-full')}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drag handle */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-12 items-end justify-center pb-1">
          <div
            className={cn(
              'pointer-events-auto inline-flex cursor-row-resize touch-none select-none items-center gap-2 rounded-full border border-border/40 bg-background/90 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 shadow-elevation-2 backdrop-blur-md transition-all duration-200 hover:border-primary/25 hover:text-muted-foreground hover:shadow-elevation-3',
              openProgress > 0.75 && 'shadow-elevation-1',
            )}
            onPointerDown={handlePointerDown}
            role="button"
            aria-label={open ? 'Push up to close assistant workspace' : 'Pull down to open assistant workspace'}
            tabIndex={0}
          >
            <div className="flex flex-col items-center gap-[2.5px]">
              <span className="block h-[1.5px] w-5 rounded-full bg-current opacity-30" />
              <span className="block h-[1.5px] w-3 rounded-full bg-current opacity-18" />
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300 ease-out', openProgress > 0.75 && 'rotate-180')} />
            <span>{openProgress > 0.75 ? 'Push up' : 'Pull down assistant'}</span>
          </div>
        </div>
      </section>
    </>
  );
};
