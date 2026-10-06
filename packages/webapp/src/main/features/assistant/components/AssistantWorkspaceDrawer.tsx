/**
 * AssistantWorkspaceDrawer — bottom-sheet drawer (rises from the bottom edge) that delegates all
 * assistant business logic to the shared useAssistantLogic hook.
 *
 * Owns only the drag-to-open/close gesture, layout animation, and rendering.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, Boxes, Bot, ChevronDown, MessageSquarePlus, Layers, Palette, Code2, Sparkles, Flag, KeyRound, Check, MoreHorizontal } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { GeneratorType } from '../../../app/shell/workspace-types';
import type { GenerationResult } from '../../generation/types';
import { useAssistantLogic, type ConnectionStatus } from '../hooks/useAssistantLogic';
import { shouldOpenGuiTab, isReviewSpecAction, type GuiActionRouteInput } from '../hooks/suggestedActionRouting';
import { resolveDrawerSnap } from '../hooks/drawerGesture';
import { AssistantByokDialog } from './AssistantByokDialog';
import { QuickActions } from './QuickActions';
import { ModelOverviewPanel } from './ModelOverviewPanel';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { openPushDialog, selectHasLiveSpecDrivenRun } from '../../spec-driven/state/specDrivenSlice';
import { sessionStoragePendingAssistantPrompt, sessionStorageAssistantHandleHinted } from '../../../shared/constants/constant';
import { readLlmKey } from '../../../shared/services/llmKeyStorage';
import { PilotSessionNotice } from '../../../shared/components/pilot/PilotSessionNotice';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface AssistantWorkspaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerGenerator?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
  onSwitchDiagram?: (diagramType: string) => Promise<boolean>;
  /** Show the floating trigger pill (only on the editor canvas, where it doesn't cover page content). */
  showTrigger?: boolean;
}

interface DragState {
  pointerId: number;
  startY: number;
  startOffset: number;
  /** Full travel (px) measured at press time: offset of the closed position. */
  travel: number;
  /** Live sheet offset (px); written straight to the DOM, not to state. */
  offset: number;
  lastY: number;
  lastTime: number;
  /** px/ms of the last move, positive = toward open (finger moving up). */
  velocity: number;
  moved: number;
}

const FALLBACK_CLOSED_OFFSET = 640;

/** Toggle floating decoration cards on the sides of the welcome screen. */
const SHOW_FLOATING_CARDS = false;

/** All available starter prompt i18n keys — a random subset is displayed each session. */
const ALL_STARTER_PROMPT_KEYS = [
  // Class Diagrams
  'assistant.starterPrompts.ecommerce',
  'assistant.starterPrompts.university',
  'assistant.starterPrompts.hospital',
  'assistant.starterPrompts.library',
  'assistant.starterPrompts.banking',
  'assistant.starterPrompts.social',
  'assistant.starterPrompts.restaurant',
  'assistant.starterPrompts.project',
  // GUI
  'assistant.starterPrompts.hotel',
  'assistant.starterPrompts.dashboard',
  // Multi-diagram
  'assistant.starterPrompts.libraryPlatform',
  'assistant.starterPrompts.taskApp',
];

/** Pick N random prompt keys from the pool, deterministic per session. */
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

const STARTER_PROMPT_KEYS = pickRandomPrompts(ALL_STARTER_PROMPT_KEYS, 3);

/* ------------------------------------------------------------------ */
/*  Helper functions                                                   */
/* ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** The sheet's on-screen translateY (px) mid-transition, or null if unreadable. */
const readLiveOffset = (element: HTMLElement): number | null => {
  try {
    const transform = getComputedStyle(element).transform;
    if (!transform || transform === 'none') return null;
    return new DOMMatrixReadOnly(transform).m42;
  } catch {
    return null;
  }
};

/** Entrance timing for the welcome content: short fade-up, 40 ms steps. */
const entrance = (step: number): React.CSSProperties => ({
  animationDuration: '250ms',
  animationDelay: `${step * 40}ms`,
});

const getConnectionDotClass = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
    case 'reconnecting':
    case 'closing':
      return 'bg-amber-500 animate-pulse motion-reduce:animate-none';
    default:
      return 'bg-red-500';
  }
};

const getConnectionLabelKey = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'assistant.connection.connected';
    case 'connecting':
      return 'common.connecting';
    case 'reconnecting':
      return 'assistant.connection.reconnecting';
    case 'closing':
      return 'assistant.connection.closing';
    case 'closed':
    case 'disconnected':
      return 'assistant.connection.disconnected';
    default:
      return 'assistant.connection.unknown';
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
  showTrigger = true,
}) => {
  /* ---- Redux ---- */

  const dispatch = useAppDispatch();
  // While a Spec-Driven run card is live it shows its own progress —
  // suppress the chat's "Typing" chip so it doesn't stick for the whole
  // run (the run card, not the chip, is the progress surface).
  const hasLiveSpecDrivenRun = useAppSelector(selectHasLiveSpecDrivenRun);

  /* ---- i18n ---- */

  const { t } = useTranslation();
  const starterPrompts = useMemo(() => STARTER_PROMPT_KEYS.map((key) => t(key)), [t]);

  /* ---- BYOK dialog ---- */

  const [byokOpen, setByokOpen] = useState(false);
  // "Your model" blueprint side panel (data model / relationships / screens).
  const [overviewOpen, setOverviewOpen] = useState(false);
  // Re-read when the BYOK dialog opens/closes (a save/remove happens inside it),
  // not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedApiKey = useMemo(() => readLlmKey(), [byokOpen]);

  /* ---- Drag gesture state ---- */

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  // Last offset written to the sheet. The sheet transform and backdrop opacity
  // are written imperatively (never via React state) so a drag does not
  // re-render this whole component on every pointermove.
  const translateYRef = useRef(FALLBACK_CLOSED_OFFSET);

  const [drawerHeight, setDrawerHeight] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Only flips when a drag crosses the midpoint (drives the pill label).
  const [dragPastHalf, setDragPastHalf] = useState(false);

  // Replay the welcome entrance each time the sheet becomes visible, instead of
  // playing it once at mount while the sheet is still closed. Derived during
  // render so the remount lands in the same commit (no flash of settled content).
  const sheetVisible = open || isDragging;
  const [entranceKey, setEntranceKey] = useState(0);
  const [prevSheetVisible, setPrevSheetVisible] = useState(sheetVisible);
  if (sheetVisible !== prevSheetVisible) {
    setPrevSheetVisible(sheetVisible);
    if (sheetVisible) setEntranceKey((key) => key + 1);
  }
  // The composer must not remount (it owns attached files), so its wrapper
  // restarts the fade-up in place: drop the class, force a reflow, re-add it.
  const composerEntranceRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = composerEntranceRef.current;
    if (!el || entranceKey === 0) return;
    el.classList.remove('animate-fade-up');
    void el.offsetWidth;
    el.classList.add('animate-fade-up');
  }, [entranceKey]);

  // One-time "you can drag me" hint on the handle. Plays at most once per tab
  // (sessionStorage-gated) and only when the drawer starts closed, so a
  // returning user with the drawer already open never sees it. The bob itself
  // is a finite CSS animation disabled under reduced-motion (see styles.css).
  const [showHandleHint] = useState<boolean>(() => {
    try {
      if (open) return false;
      if (sessionStorage.getItem(sessionStorageAssistantHandleHinted) === '1') return false;
      sessionStorage.setItem(sessionStorageAssistantHandleHinted, '1');
      return true;
    } catch {
      return false;
    }
  });

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
    progressSteps,
    lastSentMessage,
    messageListContainerRef,
    showScrollToBottom,
    scrollMessagesToBottom,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    requestNewChat,
    reportIssue,
    assistantClient,
  } = useAssistantLogic({
    isActive: open,
    switchDiagram,
    onGenerate: onTriggerGenerator,
  });

  /* ---- "Describe your app" hand-off ----
   * The Project Hub's Describe flow stashes a plain-language prompt in
   * sessionStorage (`besser_pending_assistant_prompt`) and fires
   * `wme:assistant-run-prompt`. We open THIS drawer and, once the shared
   * WebSocket is connected, consume-and-clear the prompt exactly once and
   * auto-submit it via handleSubmit so the agent starts building immediately.
   *
   * Two feeds drive one one-shot: the live event covers the common case (this
   * drawer is already mounted when the dialog fires), while the sessionStorage
   * stash is the fallback for a too-early event (e.g. this lazy chunk was still
   * loading). `promptConsumedRef` guards against double-submits, and the stash
   * key is cleared the instant we read it, so a re-render or the sibling widget
   * surface can never replay it. */
  const pendingPromptRef = useRef<string | null>(null);
  const promptConsumedRef = useRef(false);
  const [hasPendingPrompt, setHasPendingPrompt] = useState(false);

  // Register the trigger listener + do a mount-time stash check. Runs once.
  useEffect(() => {
    const armPrompt = (raw: string) => {
      const prompt = raw.trim();
      if (!prompt || promptConsumedRef.current || pendingPromptRef.current) return;
      pendingPromptRef.current = prompt;
      setHasPendingPrompt(true);
      // Make the drawer visible so we never submit into a hidden panel. The
      // parent's onOpenChange also hides the floating widget so only one
      // assistant surface shows.
      onOpenChange(true);
    };

    const readStash = (): string => {
      try {
        return sessionStorage.getItem(sessionStoragePendingAssistantPrompt) ?? '';
      } catch {
        return '';
      }
    };

    // Fallback: a prompt stashed before this listener existed.
    const stashed = readStash();
    if (stashed) armPrompt(stashed);

    const onRunPrompt = (event: Event) => {
      const detail = (event as CustomEvent).detail as { prompt?: string } | undefined;
      // Prefer the event payload; fall back to the stash if it carried none.
      armPrompt(typeof detail?.prompt === 'string' && detail.prompt ? detail.prompt : readStash());
    };

    window.addEventListener('wme:assistant-run-prompt', onRunPrompt);
    // Prefill: open the drawer with a starter prompt in the composer, without sending it.
    const onPrefill = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (typeof prompt !== 'string' || !prompt.trim()) return;
      setInputValue(prompt);
      onOpenChange(true);
    };
    window.addEventListener('wme:assistant-prefill', onPrefill);
    return () => {
      window.removeEventListener('wme:assistant-run-prompt', onRunPrompt);
      window.removeEventListener('wme:assistant-prefill', onPrefill);
    };
    // Intentionally run once — onOpenChange is only used to open the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume-and-submit once the panel is open AND the socket is connected.
  useEffect(() => {
    if (!hasPendingPrompt || promptConsumedRef.current) return;
    if (!open || connectionStatus !== 'connected') return;
    const prompt = pendingPromptRef.current;
    if (!prompt) return;

    // Consume: flip the guard and clear the stash BEFORE submitting so nothing
    // can replay it (double render, sibling surface, remount).
    promptConsumedRef.current = true;
    pendingPromptRef.current = null;
    setHasPendingPrompt(false);
    try {
      sessionStorage.removeItem(sessionStoragePendingAssistantPrompt);
    } catch {
      // Ignore storage failures — the in-memory guard already prevents replay.
    }
    void handleSubmit(undefined, { overrideText: prompt });
  }, [hasPendingPrompt, open, connectionStatus, handleSubmit]);

  /* ---- Quick action handler ---- */

  // A "Review the spec" chip closes the drawer so the user sees the diagram
  // on the canvas (it's already rendered) — never relayed to the agent. A
  // "view/modify the GUI" chip switches to the GUI tab instead of relaying a
  // prompt the agent can't act on; every other chip relays its prompt as chat.
  const handleQuickAction = useCallback((action: GuiActionRouteInput) => {
    if (isReviewSpecAction(action)) {
      onOpenChange(false);
      return;
    }
    if (shouldOpenGuiTab(action)) {
      void switchDiagram('GUINoCodeDiagram');
      return;
    }
    handleSubmit(undefined, { overrideText: action.prompt ?? '' });
  }, [handleSubmit, onOpenChange]);

  // Stable so memoised chat messages skip re-rendering. Opening the push
  // dialog is a pure dispatch — the dialog is mounted app-level
  // (SpecDrivenPushDialogHost) and driven by Redux.
  const handlePushToGithub = useCallback((runId: string) => dispatch(openPushDialog(runId)), [dispatch]);
  const messageOptions = useMemo(() => ({ onPushToGithub: handlePushToGithub }), [handlePushToGithub]);
  const closeOverview = useCallback(() => setOverviewOpen(false), []);

  /* ---- Last assistant message meta (for QuickActions) ---- */

  let lastAssistantMsg: (typeof messages)[number] | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantMsg = messages[i];
      break;
    }
  }
  const lastMeta = lastAssistantMsg ? messageMeta[lastAssistantMsg.id] : undefined;

  /* ---- Drawer measurement & animation ---- */

  // Closed = pushed fully below the container; the trigger pill floats separately.
  const closedOffset = isMeasured && drawerHeight > 0 ? drawerHeight : FALLBACK_CLOSED_OFFSET;
  const hasConversation = messages.length > 0;

  /** Write the sheet offset (null = parked fully below, pre-measure) and the
   * matching backdrop opacity straight to the DOM. */
  const applySheetOffset = useCallback((offset: number | null, travel: number) => {
    translateYRef.current = offset ?? travel;
    const sheet = drawerRef.current;
    if (sheet) sheet.style.transform = offset === null ? 'translateY(100%)' : `translateY(${offset}px)`;
    const backdrop = backdropRef.current;
    if (backdrop) {
      const progress = offset === null ? 0 : clamp((travel - offset) / Math.max(1, travel), 0, 1);
      backdrop.style.opacity = String(progress * 0.75);
    }
  }, []);

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

  // Settle to the open/closed position whenever not dragging. Runs before paint;
  // the section's transition-transform animates the change.
  useLayoutEffect(() => {
    if (isDragging) return;
    if (!isMeasured) {
      applySheetOffset(open ? 0 : null, FALLBACK_CLOSED_OFFSET);
      return;
    }
    applySheetOffset(open ? 0 : closedOffset, closedOffset);
  }, [applySheetOffset, closedOffset, isDragging, isMeasured, open]);

  /* ---- Focus: composer on open, back to the pill on close ---- */

  const wasOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open === wasOpen) return;
    const sheet = drawerRef.current;
    if (open) {
      // Phones would pop the keyboard over the sheet; leave focus alone there.
      if (window.matchMedia?.('(pointer: coarse)')?.matches) return;
      // Next frame, once the slide-in has started. Never steal focus that a
      // hand-off (or the user) already placed in the sheet, or from a dialog.
      const frame = requestAnimationFrame(() => {
        if (!sheet || sheet.contains(document.activeElement)) return;
        if (document.querySelector('[role="dialog"][data-state="open"]')) return;
        sheet.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
    // Closing makes the sheet inert, which drops focus to <body>; hand it to
    // the pill so keyboard users stay where they were.
    const active = document.activeElement;
    if (!active || active === document.body || sheet?.contains(active)) {
      pillRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  /* ---- Escape key ---- */

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Already handled by something inside (composer blur, model panel,
      // a menu), or it belongs to an IME composition.
      if (event.defaultPrevented || event.isComposing) return;
      // A modal dialog (BYOK / Push-to-GitHub) mounted on top owns Escape —
      // let Radix dismiss it and don't collapse the drawer (which would lose
      // the chat). The drawer itself is a custom <section> bottom-sheet, not a
      // [role="dialog"], so this only skips for the Radix dialogs above it.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      onOpenChange(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [onOpenChange, open]);

  /* ---- Drag gesture handlers ---- */

  // The pill shows its "open" face past the midpoint while dragging.
  const showOpenFace = isDragging ? dragPastHalf : open;

  const updateDragPosition = (clientY: number) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const now = performance.now();
    const dragDistance = clientY - dragState.startY;
    const rawOffset = dragState.startOffset + dragDistance;
    // Past the fully-open position, add friction instead of a hard stop.
    const nextOffset = rawOffset < 0 ? -Math.sqrt(-rawOffset) * 2 : Math.min(rawOffset, dragState.travel);
    const deltaTime = Math.max(1, now - dragState.lastTime);
    // Negated: the finger moving up (clientY shrinking) is toward open.
    dragState.velocity = -(clientY - dragState.lastY) / deltaTime;
    dragState.moved = Math.max(dragState.moved, Math.abs(dragDistance));
    dragState.lastY = clientY;
    dragState.lastTime = now;
    dragState.offset = nextOffset;
    applySheetOffset(nextOffset, dragState.travel);
    const pastHalf = nextOffset < dragState.travel / 2;
    setDragPastHalf((prev) => (prev === pastHalf ? prev : pastHalf));
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
    // Click → toggle; fast flick → follow it; otherwise snap by position. The
    // settle layout effect then animates to the target (isDragging flipped).
    deps.onOpenChange(
      resolveDrawerSnap({
        moved: dragState.moved,
        velocity: dragState.velocity,
        msSinceLastMove: performance.now() - dragState.lastTime,
        offset: dragState.offset,
        closedOffset: dragState.travel,
        currentlyOpen: deps.open,
      }),
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    // One gesture at a time: ignore a second finger / pointer mid-drag.
    if (dragStateRef.current) return;
    const measuredHeight = isMeasured ? drawerHeight : ensureMeasuredDrawerHeight();
    if (measuredHeight <= 0) return;
    // Catch the sheet where it is on screen, even mid-snap: the transition is
    // dropped this same frame, so starting from the target would jump.
    const liveOffset = drawerRef.current ? readLiveOffset(drawerRef.current) : null;
    const startOffset = clamp(liveOffset ?? (open ? translateYRef.current : measuredHeight), 0, measuredHeight);
    applySheetOffset(startOffset, measuredHeight);
    setDragPastHalf(startOffset < measuredHeight / 2);
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
      travel: measuredHeight,
      offset: startOffset,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      moved: 0,
    };
    setIsDragging(true);
  };

  // Keyboard activation: the handle is a focusable toggle button, so Enter and
  // Space open/close it (pointer drag has no keyboard equivalent — a plain
  // toggle is the accessible behaviour).
  const handleHandleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onOpenChange(!open);
    }
  };

  // Stable refs for values used inside drag handlers — avoids re-registering
  // event listeners when only derived values change.
  const dragDepsRef = useRef({ open, onOpenChange });
  dragDepsRef.current = { open, onOpenChange };

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

  // Composer for both the welcome screen and the chat view. Mirrors the
  // widget's MessageInput wiring exactly so voice recording + transcription
  // behaves identically here (mic button is gated on `onVoiceSend`).
  const renderComposer = (className: string) => (
    <ChatForm className={className} isPending={isGenerating} handleSubmit={handleSubmit}>
      {({ files, setFiles }) => (
        <MessageInput
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={t('assistant.composer.placeholder')}
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
      {/* Trigger pill — floats at the bottom centre in both states; only the
          sheet behind it moves. Click toggles, drag up opens / down closes.
          First in DOM order so Tab goes pill → sheet; z-index keeps it on top. */}
      {/* Centered, but shifted right just enough to clear the canvas controls bar (published by the engine). */}
      <div
        className={cn('pointer-events-none absolute inset-x-0 bottom-3 z-[45] flex justify-center', !showTrigger && !open && 'hidden')}
        style={{ paddingLeft: 'max(0px, calc(2 * (var(--besser-canvas-controls-right, 0px) + 100px) - 100%))' }}
      >
        <div
          ref={pillRef}
          className={cn(
            'pointer-events-auto flex h-9 cursor-pointer touch-none select-none items-center gap-2 rounded-full border border-border/70 pl-1.5 pr-4 text-[13px] font-medium',
            'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-10px_rgba(0,0,0,0.25)] backdrop-blur-md',
            'transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none',
            'outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            showOpenFace
              ? 'bg-background text-muted-foreground hover:text-foreground'
              : 'bg-background/85 text-foreground hover:border-brand/40',
            showHandleHint && !showOpenFace && 'drawer-handle-bob',
          )}
          onPointerDown={handlePointerDown}
          onKeyDown={handleHandleKeyDown}
          role="button"
          aria-label={open ? t('assistant.drawer.pushToClose') : t('assistant.drawer.pullToOpen')}
          aria-expanded={open}
          tabIndex={0}
        >
          {/* The icon names where a click takes you: the assistant, or back to the model. */}
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
              showOpenFace ? 'bg-muted text-muted-foreground' : 'bg-brand/10 text-brand',
            )}
            aria-hidden="true"
          >
            {showOpenFace ? <ChevronDown className="size-3.5" /> : <Bot className="size-3.5" />}
          </span>
          <span>
            {showOpenFace ? t('assistant.drawer.labelOpen') : t('assistant.drawer.labelClosed')}
          </span>
        </div>
      </div>

      {/* Backdrop overlay — opacity is written imperatively (applySheetOffset);
          it tracks the finger 1:1 while dragging, so no transition then. */}
      <div
        ref={backdropRef}
        className={cn(
          'pointer-events-none absolute inset-0 z-30 bg-slate-950/50 opacity-0 backdrop-blur-[3px]',
          !isDragging && 'transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          (open || isDragging) && 'pointer-events-auto',
        )}
        onClick={() => onOpenChange(false)}
      />

      <section
        ref={drawerRef}
        className={cn(
          'pointer-events-none absolute inset-0 z-40 flex flex-col overflow-visible bg-transparent',
          // iOS-style drawer curve (as in Vaul).
          !isDragging && 'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
        )}
        // transform is written imperatively (applySheetOffset), never by React.
        aria-hidden={!open && !isDragging}
        {...((!open && !isDragging ? { inert: '' } : {}) as React.HTMLAttributes<HTMLElement>)}
      >
        {/* Content area */}
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.25)] transition-opacity duration-300',
            (open || isDragging) ? 'pointer-events-auto' : 'pointer-events-none',
            !open && !isDragging && 'opacity-0',
          )}
        >
          {/* Grab bar: drag down (or click) to return to the model. A tall
              strip (h-8) rather than drag-from-content, which would fight
              text selection and the scroll containers. */}
          <div
            aria-hidden="true"
            onPointerDown={handlePointerDown}
            className="absolute inset-x-0 top-0 z-20 flex h-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
          </div>
          {!hasConversation ? (
            /* ================================================================ */
            /*  Welcome Screen — Main Landing                                    */
            /* ================================================================ */
            <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain pb-14">
              {/* ---- Floating side decorations (hidden on small screens) ---- */}
              {SHOW_FLOATING_CARDS && <div className="pointer-events-none absolute inset-0 hidden lg:block">
                {/* Left floating cards */}
                <div className="floating-card absolute left-[4%] top-[18%] rotate-[-6deg] rounded-xl border border-brand/15 bg-white/40 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/30" style={{ '--float-duration': '7s', '--float-delay': '0s', '--float-rotate': '-6deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Layers className="size-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">Class Diagram</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="h-1.5 w-20 rounded-full bg-brand/10" />
                    <div className="h-1.5 w-14 rounded-full bg-brand/7" />
                  </div>
                </div>

                <div className="floating-card absolute left-[6%] top-[48%] rotate-[-3deg] rounded-xl border border-brand/12 bg-white/35 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/25" style={{ '--float-duration': '8s', '--float-delay': '1.5s', '--float-rotate': '-3deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <svg className="size-3 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">State Machine</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <div className="size-4 rounded-full border border-brand/15 bg-brand/5" />
                    <div className="h-1.5 w-10 self-center rounded-full bg-brand/10" />
                    <div className="size-4 rounded border border-brand/15 bg-brand/5" />
                  </div>
                </div>

                <div className="floating-card absolute bottom-[22%] left-[3%] rotate-[2deg] rounded-xl border border-brand/10 bg-white/30 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/20" style={{ '--float-duration': '9s', '--float-delay': '3s', '--float-rotate': '2deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Code2 className="size-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">Django</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 font-mono text-[9px] text-muted-foreground/40">
                    <div>class Model:</div>
                    <div className="pl-2">name = CharField()</div>
                  </div>
                </div>

                {/* Right floating cards */}
                <div className="floating-card absolute right-[4%] top-[15%] rotate-[5deg] rounded-xl border border-brand/15 bg-white/40 px-4 py-3 shadow-elevation-1 backdrop-blur-sm dark:bg-slate-800/30" style={{ '--float-duration': '8s', '--float-delay': '0.5s', '--float-rotate': '5deg' } as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Palette className="size-3 text-brand" />
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
                    <div className="flex size-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <svg className="size-3 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
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
                    <div className="flex size-6 items-center justify-center rounded-md bg-brand/[0.12]">
                      <Sparkles className="size-3 text-brand" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/60">React App</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 font-mono text-[9px] text-muted-foreground/40">
                    <div>{'<Dashboard />'}</div>
                    <div>{'<UserTable />'}</div>
                  </div>
                </div>
              </div>}

              {/* Top spacer — pushes content to vertical center */}
              <div className="flex-[1_1_10%] min-h-6" />

              {/* Welcome content column — was max-w-2xl, now max-w-5xl (1024px) for wider screens */}
              {/* The fade-up replays each time the sheet opens: the text wrappers
                  are keyed on entranceKey (remount restarts the animation); the
                  composer wrapper restarts via a ref so draft + files survive. */}
              <div className="relative z-10 w-full max-w-5xl px-6 sm:px-8">

                {/* Brand mark + AI badge */}
                <div key={`entrance-logo-${entranceKey}`} className="animate-fade-up flex items-center justify-center gap-3" style={entrance(0)}>
                  <img
                    src="/images/logo.png"
                    alt="BESSER"
                    className="h-9 w-auto brightness-0 opacity-70 dark:invert sm:h-10"
                  />
                  <a
                    href="https://besser-agentic-framework.readthedocs.io/latest/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full bg-brand/[0.08] px-2.5 py-1 text-xs font-medium text-brand ring-1 ring-brand/20 transition-colors hover:bg-brand/[0.15] hover:ring-brand/40"
                  >
                    <Sparkles className="size-3" />
                    {t('assistant.poweredWithBaf')}
                  </a>
                </div>

                {/* Headline */}
                <h1
                  key={`entrance-headline-${entranceKey}`}
                  className="animate-fade-up mt-7 text-center font-display text-[2.25rem] leading-[1.12] tracking-tight sm:text-[2.75rem] lg:text-5xl"
                  style={entrance(1)}
                >
                  {t('assistant.welcome.headlinePre')}{' '}
                  <em className="gradient-text-model font-display not-italic">{t('assistant.welcome.headlineEmphasis')}</em> {t('assistant.welcome.headlinePost')}
                </h1>

                {/* Subtitle + connection status */}
                <p
                  key={`entrance-subtitle-${entranceKey}`}
                  className="animate-fade-up mt-4 text-center text-sm leading-relaxed text-muted-foreground sm:text-[15px]"
                  style={entrance(2)}
                >
                  {t('assistant.welcome.subtitle')}
                  <span className="ml-2.5 inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn('inline-block size-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
                    <span className="text-muted-foreground/70">{t(getConnectionLabelKey(connectionStatus))}</span>
                  </span>
                </p>

                {/* Chat input — static gradient border, capped at max-w-2xl */}
                <div
                  ref={composerEntranceRef}
                  className="animate-fade-up mx-auto mt-9 max-w-2xl"
                  style={entrance(3)}
                >
                  <div className="input-card-glow rounded-2xl p-3 shadow-elevation-3 sm:p-4">
                    {renderComposer('w-full')}
                  </div>
                  {/* Free-tier promo — no API key needed; link opens the shared BYOK dialog */}
                  <p className="mt-2.5 text-center text-xs text-muted-foreground">
                    {t('assistant.welcome.freeTier')}{' '}
                    <button
                      type="button"
                      onClick={() => setByokOpen(true)}
                      className="font-medium text-brand underline-offset-2 transition-colors hover:text-brand-dark hover:underline"
                    >
                      {t('assistant.welcome.changeModel')}
                    </button>
                  </p>
                </div>

                {/* Starter prompt pills */}
                <div
                  key={`entrance-pills-${entranceKey}`}
                  className="animate-fade-up mt-5 flex flex-wrap justify-center gap-2"
                  style={entrance(4)}
                >
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputValue(prompt)}
                      className="rounded-full border border-brand/15 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-[color,background-color,border-color,box-shadow,transform] duration-200 hover:border-brand/30 hover:bg-brand/5 hover:text-foreground hover:shadow-sm [@media(hover:hover)]:hover:-translate-y-px dark:bg-slate-800/40 dark:hover:border-brand/25 dark:hover:bg-brand/8"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Capability cards — three branded cards (hidden; set to true to show) */}
                {false && (
                <div
                  className="animate-fade-up mt-10 grid grid-cols-3 gap-3"
                  style={entrance(5)}
                >
                  <Card className="capability-card group relative overflow-hidden border-brand/12 bg-white/50 backdrop-blur-sm dark:bg-slate-800/30">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }} />
                    <CardContent className="p-4 text-center">
                      <div className="mx-auto flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                        <Layers className="size-4" />
                      </div>
                      <p className="mt-2.5 text-xs font-medium text-muted-foreground">{t('assistant.capabilities.systemDesign.title')}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                        {t('assistant.capabilities.systemDesign.body')}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="capability-card group relative overflow-hidden border-brand/12 bg-white/50 backdrop-blur-sm dark:bg-slate-800/30">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }} />
                    <CardContent className="p-4 text-center">
                      <div className="mx-auto flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                        <Palette className="size-4" />
                      </div>
                      <p className="mt-2.5 text-xs font-medium text-muted-foreground">{t('assistant.capabilities.visualInterfaces.title')}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                        {t('assistant.capabilities.visualInterfaces.body')}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="capability-card group relative overflow-hidden border-brand/12 bg-white/50 backdrop-blur-sm dark:bg-slate-800/30">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }} />
                    <CardContent className="p-4 text-center">
                      <div className="mx-auto flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                        <Code2 className="size-4" />
                      </div>
                      <p className="mt-2.5 text-xs font-medium text-muted-foreground">{t('assistant.capabilities.codeGeneration.title')}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                        {t('assistant.capabilities.codeGeneration.body')}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                )}
              </div>

              {/* Bottom spacer + footer */}
              <div className="flex-[1_1_8%] min-h-4" />
              {/* Study-mode notice (regular sessions render nothing) */}
              <PilotSessionNotice className="pb-1.5" />
              <p key={`entrance-hint-${entranceKey}`} className="animate-fade-up pb-4 text-center text-[10px] text-muted-foreground/35" style={entrance(5)}>
                {t('assistant.welcome.pressEscPre')} <kbd className="rounded-[3px] border border-border/30 bg-muted/25 px-1.5 py-0.5 font-mono text-[9px]">Esc</kbd> {t('assistant.welcome.pressEscPost')}
              </p>
            </div>
          ) : (
            /* ================================================================ */
            /*  Chat View                                                        */
            /* ================================================================ */
            <>
              {/* Messages — kept at max-w-4xl (896px) for readability */}
              <div className="relative min-h-0 flex-1">
                <div ref={messageListContainerRef} className="h-full overflow-y-auto overscroll-contain bg-gradient-to-b from-muted/10 via-background to-muted/5 px-4 py-6 sm:px-8">
                  <div className="mx-auto w-full max-w-4xl">
                    {/* Study-mode notice (regular sessions render nothing) */}
                    <PilotSessionNotice className="mb-4" />
                    <MessageList
                      messages={messages}
                      isTyping={isGenerating && !hasLiveSpecDrivenRun}
                      typingLabel={progressSteps.length > 0 ? progressSteps[progressSteps.length - 1] : undefined}
                      showTimeStamps={false}
                      messageOptions={messageOptions}
                    />


                    {/* Quick actions after last assistant message */}
                    {lastMeta?.suggestedActions && lastMeta.suggestedActions.length > 0 && (
                      <QuickActions actions={lastMeta.suggestedActions} onAction={handleQuickAction} />
                    )}

                    {/* Limit reached / auth error → offer the user their own key */}
                    {lastMeta?.needsApiKey && (
                      <div className="mt-3 flex justify-start">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg bg-brand text-brand-foreground hover:bg-brand-dark"
                          onClick={() => setByokOpen(true)}
                        >
                          <KeyRound className="size-3.5" />
                          {t('assistant.chat.addApiKey', 'Add your API key')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {/* "Your model" blueprint — Mentor-style recap of the data
                    model, relationships and screens, derived live from the
                    project store. */}
                {overviewOpen && <ModelOverviewPanel onClose={closeOverview} />}

                {/* Scroll-to-bottom — shown while the user has scrolled up;
                    streaming no longer force-follows their position */}
                {showScrollToBottom && (
                  <button
                    type="button"
                    aria-label="Scroll to bottom"
                    onClick={scrollMessagesToBottom}
                    className="absolute bottom-4 right-6 z-10 rounded-full border border-border/60 bg-background/95 p-2 text-muted-foreground shadow-md backdrop-blur transition-colors hover:bg-muted hover:text-foreground animate-in fade-in-0 slide-in-from-bottom-1"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                )}
              </div>

              {/* Bottom bar — kept at max-w-4xl (896px) to match messages */}
              <div className="shrink-0 border-t border-border/40 bg-background/85 px-4 pb-14 pt-3 backdrop-blur-md sm:px-8">
                <div className="mx-auto w-full max-w-4xl">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                      <span className={cn('size-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
                      <span className="font-medium">{t(getConnectionLabelKey(connectionStatus))}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('mr-1 font-mono text-[10px] tracking-wide', rateLimitColor)}>{rateLimitStatus.requestsLastMinute}/8</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 rounded-lg border-border/50 px-2.5 text-xs"
                        onClick={requestNewChat}
                        title={t('assistant.chat.newConversationTitle')}
                      >
                        <MessageSquarePlus className="size-3.5" />
                        {t('assistant.chat.newChat')}
                      </Button>
                      {/* Secondary actions live behind one quiet trigger so the
                          composer is not crowned by a row of equal buttons.
                          Non-modal: an item can open a dialog without Radix
                          leaving pointer-events locked on <body>. */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'size-7 rounded-lg text-muted-foreground hover:text-foreground',
                              overviewOpen && 'bg-brand/[0.06] text-brand hover:text-brand',
                            )}
                            aria-label={t('assistant.chat.moreActions', 'More actions')}
                            title={t('assistant.chat.moreActions', 'More actions')}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top" className="w-56">
                          <DropdownMenuItem className="gap-2 text-xs" onSelect={() => setOverviewOpen((v) => !v)}>
                            <Boxes className="size-3.5 text-muted-foreground" />
                            {overviewOpen
                              ? t('assistant.chat.hideYourModel', 'Hide your model')
                              : t('assistant.chat.yourModel', 'Your model')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-xs" onSelect={() => setByokOpen(true)}>
                            <KeyRound className={cn('size-3.5', savedApiKey ? 'text-brand' : 'text-muted-foreground')} />
                            {savedApiKey
                              ? t('assistant.chat.apiKeySet', 'API key set')
                              : t('assistant.chat.useOwnApiKey', 'Use your own API key')}
                            {savedApiKey ? <Check className="ml-auto size-3 text-brand" /> : null}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-xs" onSelect={() => void reportIssue()}>
                            <Flag className="size-3.5 text-muted-foreground" />
                            {t('assistant.chat.reportIssue', 'Report issue')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {renderComposer('w-full')}
                </div>
              </div>
            </>
          )}

        </div>

      </section>

      {/* ── Bring-your-own-key dialog ── */}
      <AssistantByokDialog open={byokOpen} onOpenChange={setByokOpen} client={assistantClient} />

      {/* Push-to-GitHub dialog is mounted app-level (SpecDrivenPushDialogHost) and
          opened via dispatch(openPushDialog(runId)) — see messageOptions above. */}
    </>
  );
};
