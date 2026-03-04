/**
 * AssistantWorkspaceDrawer — bottom-sheet style drawer that delegates all
 * assistant business logic to the shared useAssistantLogic hook.
 *
 * Owns only the drag-to-open/close gesture, layout animation, and rendering.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Boxes, WandSparkles, Workflow, MessageSquarePlus } from 'lucide-react';
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
  // State Machines
  'Create an order processing state machine with payment and shipping states',
  'Design a user authentication flow with login, MFA, and session states',
  'Model a document approval workflow with review and publish stages',
  'Build a support ticket lifecycle from creation to resolution',
  // GUI
  'Generate a web app for hotel booking',
  'Design a dashboard for inventory management',
  'Create a modern landing page for a SaaS product',
  // Multi-diagram
  'Create a library management platform',
  'Build a complete task management application with models and UI',
  'Design an API for IoT monitoring',
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
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-30 bg-slate-950/70 transition-opacity duration-200',
          (open || isDragging) && openProgress > 0.02 && 'pointer-events-auto',
        )}
        style={{ opacity: openProgress * 0.65 }}
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
            'flex min-h-0 flex-1 flex-col border-t border-border bg-background pb-12 transition-opacity duration-200',
            (open || isDragging) ? 'pointer-events-auto' : 'pointer-events-none',
            openProgress < 0.02 && !open && !isDragging && 'opacity-0',
          )}
        >
          {!hasConversation ? (
            /* ================================================================ */
            /*  Welcome Screen                                                   */
            /* ================================================================ */
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 sm:px-8">
              <div className="pointer-events-none absolute -left-24 top-8 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
              <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-500/10" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(100,116,139,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.22)_1px,transparent_1px)] [background-size:56px_56px]" />

              <div className="relative flex min-h-[30%] w-full items-start justify-center pt-3 sm:min-h-[33%] sm:pt-8">
                <div className="w-full max-w-4xl text-center">
                  <img src="/images/logo.png" alt="BESSER" className="mx-auto h-14 w-auto brightness-0 dark:invert sm:h-16" />
                  <div className="mt-6 space-y-3">
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Welcome to the BESSER Web Modeling Assistant
                    </h2>
                    <p className="mx-auto max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                      Describe your idea in natural language and shape it into a model-ready project.{' '}
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span
                          className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            getConnectionDotClass(connectionStatus),
                          )}
                        />
                        {getConnectionLabel(connectionStatus)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Step-numbered feature cards */}
              <div className="relative mx-auto grid w-full max-w-5xl gap-3 pb-6 sm:grid-cols-3">
                <div className="group relative rounded-2xl border border-sky-200/70 bg-sky-50/75 p-4 transition-shadow hover:shadow-md dark:border-sky-900/60 dark:bg-sky-950/20">
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white shadow-sm">1</span>
                  <div className="mb-3 inline-flex rounded-lg bg-sky-500/15 p-2 text-sky-700 dark:text-sky-300">
                    <WandSparkles className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Describe your system</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tell me about your domain in plain language — classes, entities, and workflows get created automatically.</p>
                </div>
                <div className="group relative rounded-2xl border border-emerald-200/70 bg-emerald-50/75 p-4 transition-shadow hover:shadow-md dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-sm">2</span>
                  <div className="mb-3 inline-flex rounded-lg bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Refine iteratively</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add attributes, relationships, states, and GUI pages — ask for changes in natural language.</p>
                </div>
                <div className="group relative rounded-2xl border border-violet-200/70 bg-violet-50/75 p-4 transition-shadow hover:shadow-md dark:border-violet-900/60 dark:bg-violet-950/20">
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-sm">3</span>
                  <div className="mb-3 inline-flex rounded-lg bg-violet-500/15 p-2 text-violet-700 dark:text-violet-300">
                    <Workflow className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Generate code</p>
                  <p className="mt-1 text-xs text-muted-foreground">Export to Django, React, Flutter, SQL, or deploy as a full-stack web app.</p>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center pb-6 sm:pb-10">
                <div className="w-full max-w-2xl space-y-3">
                  <div className="flex flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInputValue(prompt)}
                        className="rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-slate-400 hover:text-foreground dark:hover:border-slate-500"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/90 p-3 shadow-lg backdrop-blur sm:p-4">
                    {renderComposer('w-full')}
                  </div>
                  <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
                    Press <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[9px]">Esc</kbd> to close
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ================================================================ */
            /*  Chat View                                                        */
            /* ================================================================ */
            <>
              {/* Message list */}
              <div ref={messageListContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-6 sm:px-8">
                <div className="mx-auto w-full max-w-4xl">
                  <MessageList messages={messages} isTyping={isGenerating} showTimeStamps={false} />
                </div>
              </div>

              {/* Action bar + input composer */}
              <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-8">
                <div className="mx-auto w-full max-w-4xl">
                  <div className="mb-2 flex items-center justify-end gap-2">
                    <span className={cn('text-[11px]', rateLimitColor)}>{rateLimitStatus.requestsLastMinute}/8</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={clearConversation}
                      title="Start a new conversation"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      New Chat
                    </Button>
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
              'pointer-events-auto inline-flex cursor-row-resize touch-none select-none items-center gap-2 rounded-full border border-border/80 bg-background/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-md backdrop-blur transition-shadow hover:shadow-lg',
              openProgress > 0.75 && 'shadow-sm',
            )}
            onPointerDown={handlePointerDown}
            role="button"
            aria-label={open ? 'Push up to close assistant workspace' : 'Pull down to open assistant workspace'}
            tabIndex={0}
          >
            {/* Visual grab lines */}
            <div className="flex flex-col items-center gap-[3px]">
              <span className="block h-[2px] w-5 rounded-full bg-current opacity-40" />
              <span className="block h-[2px] w-3.5 rounded-full bg-current opacity-25" />
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', openProgress > 0.75 && 'rotate-180')} />
            <span>{openProgress > 0.75 ? 'Push up' : 'Pull down assistant'}</span>
          </div>
        </div>
      </section>
    </>
  );
};
