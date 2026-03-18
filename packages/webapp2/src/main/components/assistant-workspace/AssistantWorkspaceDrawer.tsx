/**
 * AssistantWorkspaceDrawer — bottom-sheet style drawer that delegates all
 * assistant business logic to the shared useAssistantLogic hook.
 *
 * Owns only the drag-to-open/close gesture, layout animation, and rendering.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MessageSquarePlus, Layers, Palette, Code2, Sparkles } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';
import { useAssistantLogic, type ConnectionStatus } from './useAssistantLogic';
import { QuickActions } from './components/QuickActions';

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

const HANDLE_HEIGHT = 28;
const FALLBACK_CLOSED_OFFSET = -640;
const VELOCITY_SNAP_THRESHOLD = 0.35;
const POSITION_SNAP_THRESHOLD = 0.45;

/** Toggle floating decoration cards on the sides of the welcome screen. */
const SHOW_FLOATING_CARDS = false;

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
  'Design a hotel booking web app with rooms, guests, and reservations',
  'Design a dashboard for inventory management',
  // Multi-diagram
  'Build a complete library management platform with models and UI',
  'Build a task management application with models and UI',
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

const STARTER_PROMPTS = pickRandomPrompts(ALL_STARTER_PROMPTS, 3);

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
    messageMeta,
    progressMessage,
    lastSentMessage,
    messageListContainerRef,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    clearConversation,
  } = useAssistantLogic({
    isActive: open,
    switchDiagram,
    onGenerate: onTriggerGenerator,
  });

  /* ---- Quick action handler ---- */

  const handleQuickAction = useCallback((prompt: string) => {
    setInputValue(prompt);
    queueMicrotask(() => {
      handleSubmit();
    });
  }, [handleSubmit, setInputValue]);

  /* ---- Last assistant message meta (for QuickActions) ---- */

  const lastAssistantMsg = messages.length > 0
    ? [...messages].reverse().find((m) => m.role === 'assistant')
    : undefined;
  const lastMeta = lastAssistantMsg ? messageMeta[lastAssistantMsg.id] : undefined;

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
          onVoiceSend={(blob) => sendVoiceMessage(blob)}
          allowAttachments
          files={files}
          setFiles={setFiles}
          stop={stopGenerating}
          isGenerating={isGenerating}
          lastSentMessage={lastSentMessage}
          onValueChange={setInputValue}
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
            'flex min-h-0 flex-1 flex-col bg-background shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] transition-opacity duration-300',
            (open || isDragging) ? 'pointer-events-auto' : 'pointer-events-none',
            openProgress < 0.02 && !open && !isDragging && 'opacity-0',
          )}
        >
          {!hasConversation ? (
            /* ================================================================ */
            /*  Welcome Screen — Main Landing                                    */
            /* ================================================================ */
            <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden">
              {/* ---- Background: animated gradient orbs using brand palette ---- */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Subtle dot grid */}
                <div className="absolute inset-0 opacity-[0.03] [background-image:radial-gradient(circle,hsl(var(--brand)/0.5)_0.8px,transparent_0.8px)] [background-size:24px_24px] dark:opacity-[0.05]" />
                {/* Primary brand orb — top left, large */}
                <div className="drawer-orb-1 absolute -left-10 -top-10 h-[550px] w-[550px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, hsl(var(--brand) / 0.25) 0%, hsl(var(--brand) / 0.08) 50%, transparent 70%)' }} />
                {/* Secondary orb — right side */}
                <div className="drawer-orb-2 absolute right-0 top-[15%] h-[450px] w-[450px] rounded-full blur-[90px]" style={{ background: 'radial-gradient(circle, hsl(var(--brand-light) / 0.2) 0%, hsl(var(--brand-dark) / 0.06) 50%, transparent 70%)' }} />
                {/* Bottom accent orb */}
                <div className="drawer-orb-3 absolute -bottom-20 left-[20%] h-[400px] w-[400px] rounded-full blur-[80px]" style={{ background: 'radial-gradient(circle, hsl(var(--brand) / 0.15) 0%, hsl(var(--brand-light) / 0.05) 50%, transparent 70%)' }} />
                {/* Warm contrast — subtle amber far right */}
                <div className="drawer-orb-2 absolute -right-20 top-[5%] h-[300px] w-[300px] rounded-full bg-gradient-to-bl from-amber-100/12 to-transparent blur-[70px] dark:from-amber-500/5" />
              </div>

              {/* ---- Floating side decorations (hidden on small screens) ---- */}
              {SHOW_FLOATING_CARDS && <div className="pointer-events-none absolute inset-0 hidden lg:block">
                {/* Left floating cards */}
                <div className="floating-card absolute left-[4%] top-[18%] rotate-[-6deg] rounded-xl border border-brand/15 bg-white/40 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/30" style={{ '--float-duration': '7s', '--float-delay': '0s', '--float-rotate': '-6deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Layers className="h-3 w-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">Class Diagram</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-20 rounded-full bg-brand/10" />
                    <div className="h-1.5 w-14 rounded-full bg-brand/7" />
                  </div>
                </div>

                <div className="floating-card absolute left-[6%] top-[48%] rotate-[-3deg] rounded-xl border border-brand/12 bg-white/35 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/25" style={{ '--float-duration': '8s', '--float-delay': '1.5s', '--float-rotate': '-3deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <svg className="h-3 w-3 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">State Machine</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <div className="h-4 w-4 rounded-full border border-brand/15 bg-brand/5" />
                    <div className="h-1.5 w-10 self-center rounded-full bg-brand/10" />
                    <div className="h-4 w-4 rounded border border-brand/15 bg-brand/5" />
                  </div>
                </div>

                <div className="floating-card absolute bottom-[22%] left-[3%] rotate-[2deg] rounded-xl border border-brand/10 bg-white/30 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/20" style={{ '--float-duration': '9s', '--float-delay': '3s', '--float-rotate': '2deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Code2 className="h-3 w-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">Django</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-[9px] text-muted-foreground/40">
                    <div>class Model:</div>
                    <div className="pl-2">name = CharField()</div>
                  </div>
                </div>

                {/* Right floating cards */}
                <div className="floating-card absolute right-[4%] top-[15%] rotate-[5deg] rounded-xl border border-brand/15 bg-white/40 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/30" style={{ '--float-duration': '8s', '--float-delay': '0.5s', '--float-rotate': '5deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Palette className="h-3 w-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">GUI Design</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <div className="h-6 w-10 rounded border border-brand/12 bg-brand/5" />
                    <div className="h-6 flex-1 rounded border border-brand/12 bg-brand/3" />
                  </div>
                </div>

                <div className="floating-card absolute right-[5%] top-[44%] rotate-[3deg] rounded-xl border border-brand/12 bg-white/35 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/25" style={{ '--float-duration': '7s', '--float-delay': '2s', '--float-rotate': '3deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <svg className="h-3 w-3 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">Object Diagram</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-16 rounded-full bg-brand/10" />
                    <div className="h-1.5 w-12 rounded-full bg-brand/7" />
                  </div>
                </div>

                <div className="floating-card absolute bottom-[20%] right-[3%] rotate-[-4deg] rounded-xl border border-brand/10 bg-white/30 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/20" style={{ '--float-duration': '9s', '--float-delay': '3.5s', '--float-rotate': '-4deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Sparkles className="h-3 w-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">React App</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-[9px] text-muted-foreground/40">
                    <div>{'<Dashboard />'}</div>
                    <div>{'<UserTable />'}</div>
                  </div>
                </div>
              </div>}

              {/* Top spacer — pushes content to vertical center */}
              <div className="flex-[1_1_10%] min-h-6" />

              {/* Content column */}
              <div className="relative z-10 w-full max-w-2xl px-6 sm:px-8">

                {/* Brand mark + AI badge */}
                <div className="animate-fade-up flex items-center justify-center gap-3" style={{ animationDelay: '0ms' }}>
                  <img
                    src="/images/logo.png"
                    alt="BESSER"
                    className="h-9 w-auto brightness-0 opacity-70 dark:invert sm:h-10"
                  />
                  <span className="flex items-center gap-1 rounded-full bg-brand/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand ring-1 ring-brand/20">
                    <Sparkles className="h-3 w-3" />
                    AI-Powered
                  </span>
                </div>

                {/* Headline — gradient "model" text */}
                <h1
                  className="animate-fade-up mt-7 text-center font-display text-[2.25rem] leading-[1.12] tracking-tight sm:text-[2.75rem] lg:text-5xl"
                  style={{ animationDelay: '70ms' }}
                >
                  What would you like to{' '}
                  <em className="gradient-text-model font-display italic not-italic">model</em> today?
                </h1>

                {/* Subtitle + connection status */}
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

                {/* Chat input — animated gradient border */}
                <div
                  className="animate-fade-up mt-9"
                  style={{ animationDelay: '200ms' }}
                >
                  <div className="input-card-glow rounded-2xl p-3 shadow-elevation-3 sm:p-4">
                    {renderComposer('w-full')}
                  </div>
                </div>

                {/* Starter prompt pills */}
                <div
                  className="animate-fade-up mt-5 flex flex-wrap justify-center gap-2"
                  style={{ animationDelay: '300ms' }}
                >
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputValue(prompt)}
                      className="rounded-full border border-brand/15 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:-translate-y-px hover:border-brand/30 hover:bg-brand/5 hover:text-foreground hover:shadow-sm dark:bg-slate-800/40 dark:hover:border-brand/25 dark:hover:bg-brand/8"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Capability cards — three branded cards */}
                <div
                  className="animate-fade-up mt-10 grid grid-cols-3 gap-3"
                  style={{ animationDelay: '400ms' }}
                >
                  <div className="capability-card group relative overflow-hidden rounded-xl border border-brand/12 bg-white/50 p-4 text-center backdrop-blur-sm dark:bg-slate-800/30">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }} />
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                      <Layers className="h-4 w-4" />
                    </div>
                    <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">6 Diagram Types</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                      Class, Object, State Machine, Agent, GUI, Quantum
                    </p>
                  </div>
                  <div className="capability-card group relative overflow-hidden rounded-xl border border-brand/12 bg-white/50 p-4 text-center backdrop-blur-sm dark:bg-slate-800/30">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }} />
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                      <Palette className="h-4 w-4" />
                    </div>
                    <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">Visual Interfaces</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                      GUI screens and layouts from descriptions
                    </p>
                  </div>
                  <div className="capability-card group relative overflow-hidden rounded-xl border border-brand/12 bg-white/50 p-4 text-center backdrop-blur-sm dark:bg-slate-800/30">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }} />
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                      <Code2 className="h-4 w-4" />
                    </div>
                    <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">Code Generation</p>
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

                  {/* Progress indicator */}
                  {progressMessage && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in-0 duration-300">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{progressMessage}</span>
                    </div>
                  )}

                  {/* Quick actions after last assistant message */}
                  {lastMeta?.suggestedActions && lastMeta.suggestedActions.length > 0 && (
                    <QuickActions actions={lastMeta.suggestedActions} onAction={handleQuickAction} />
                  )}
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

        {/* Centered drag handle notch — hangs from app bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-7 items-start justify-center">
          <div
            className={cn(
              'pointer-events-auto flex cursor-row-resize touch-none select-none items-center gap-2 rounded-b-lg px-4 py-1.5 transition-all duration-200',
              openProgress > 0.5
                ? 'bg-background/90 shadow-sm backdrop-blur-sm'
                : 'bg-white/80 shadow-[0_2px_8px_-2px_hsl(var(--brand)/0.15)] backdrop-blur-sm hover:bg-white/95 hover:shadow-[0_3px_12px_-2px_hsl(var(--brand)/0.2)] dark:bg-slate-800/80 dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)] dark:hover:bg-slate-800/95',
            )}
            onPointerDown={handlePointerDown}
            role="button"
            aria-label={open ? 'Push up to close assistant' : 'Pull down to open assistant'}
            tabIndex={0}
          >
            <div className="flex flex-col items-center gap-[2px]">
              <span className="block h-[1.5px] w-4 rounded-full bg-brand/20" />
              <span className="block h-[1.5px] w-3 rounded-full bg-brand/15" />
              <span className="block h-[1.5px] w-2 rounded-full bg-brand/10" />
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
              {openProgress > 0.75 ? 'Push up' : 'Pull down assistant'}
            </span>
          </div>
        </div>
      </section>
    </>
  );
};
