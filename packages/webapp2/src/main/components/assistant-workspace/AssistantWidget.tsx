/**
 * AssistantWidget — floating chat widget that delegates all business logic
 * to the shared useAssistantLogic hook.
 *
 * Renders as a fixed FAB button in the bottom-right corner that toggles a
 * popup chat card.  Route-aware: only visible on editor pages and implements
 * diagram switching via route navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, CircleHelp, Code, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '../../store/hooks';
import { switchDiagramTypeThunk } from '../../store/workspaceSlice';
import type { SupportedDiagramType } from '../../types/project';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';
import { useAssistantLogic, type ConnectionStatus, type MessageMeta } from './useAssistantLogic';
import { QuickActions } from './components/QuickActions';
import { Z_INDEX } from '../../constants/z-index';

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const AGENT_AVATAR_SRC = '/img/agent_back.png';

const getConnectionDotClass = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
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
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AssistantWidgetProps {
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ onAssistantGenerate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnEditorPage = location.pathname === '/';

  /* ---- Widget-specific diagram switching ---- */

  const switchDiagram = async (targetType: string): Promise<boolean> => {
    if (location.pathname !== '/') {
      navigate('/');
    }

    try {
      await dispatch(switchDiagramTypeThunk({ diagramType: targetType as SupportedDiagramType })).unwrap();
      return true;
    } catch {
      return false;
    }
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
  } = useAssistantLogic({
    isActive: isVisible,
    switchDiagram,
    onGenerate: onAssistantGenerate,
  });

  /* ---- Quick action handler: submit a prompt directly ---- */
  const handleQuickAction = useCallback((prompt: string) => {
    handleSubmit(undefined, { overrideText: prompt });
  }, [handleSubmit]);

  /* ---- Keyboard shortcuts on input ---- */
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue('');
      return;
    }
    if (e.key === 'ArrowUp' && !inputValue && lastSentMessage) {
      e.preventDefault();
      setInputValue(lastSentMessage);
    }
  }, [inputValue, lastSentMessage, setInputValue]);

  /* ---- Compute last assistant message for QuickActions ---- */
  const lastAssistantMsg = messages.length > 0
    ? [...messages].reverse().find((m) => m.role === 'assistant')
    : undefined;
  const lastMeta = lastAssistantMsg ? messageMeta[lastAssistantMsg.id] : undefined;

  /* ---- Hide when not on an editor page ---- */

  useEffect(() => {
    if (!isOnEditorPage) {
      setIsVisible(false);
    }
  }, [isOnEditorPage]);

  /* ---- External toggle event ---- */

  useEffect(() => {
    const toggle = () => {
      if (!isOnEditorPage) return;
      setIsVisible((p) => !p);
    };
    window.addEventListener('besser:toggle-agent-widget', toggle);
    return () => window.removeEventListener('besser:toggle-agent-widget', toggle);
  }, [isOnEditorPage]);

  /* ---- Hide widget when the workspace drawer is open ---- */

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onDrawer = (e: Event) => {
      const open = (e as CustomEvent).detail?.open ?? false;
      setDrawerOpen(open);
      if (open) setIsVisible(false);
    };
    window.addEventListener('besser:assistant-drawer', onDrawer);
    return () => window.removeEventListener('besser:assistant-drawer', onDrawer);
  }, []);

  /* ---- Render ---- */

  if (!isOnEditorPage || drawerOpen) return null;

  const rateLimitColor =
    rateLimitStatus.cooldownRemaining > 0 || rateLimitStatus.requestsLastMinute >= 8
      ? 'text-red-500'
      : rateLimitStatus.requestsLastMinute >= 6
        ? 'text-amber-500'
        : 'text-muted-foreground';

  return (
    <>
      {/* ── Floating widget container ── */}
      <div className="fixed bottom-5 right-4 md:right-16" style={{ zIndex: Z_INDEX.NOTIFICATION }}>
        {/* ── Chat card ── */}
        <Card
          className={cn(
            'absolute bottom-[74px] right-0 flex h-[min(78vh,700px)] w-[min(96vw,520px)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background shadow-elevation-3 transition-all duration-300 ease-out sm:w-[480px] lg:w-[520px]',
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0',
          )}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between overflow-hidden border-b border-border/40 px-4 py-3.5" style={{ background: 'linear-gradient(135deg, hsl(var(--brand) / 0.06) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-brand/10 ring-1 ring-brand/15">
                <img src={AGENT_AVATAR_SRC} alt="Agent" className="size-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none tracking-tight text-foreground">Modeling Assistant</p>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground/60">by BESSER</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground/60 transition-colors hover:bg-brand/5 hover:text-foreground"
                onClick={() => setShowDisclaimer(true)}
                title="Privacy and data processing"
                aria-label="Privacy and data processing"
              >
                <CircleHelp className="size-3.5" />
              </Button>
              <span className={cn('size-2 rounded-full', getConnectionDotClass(connectionStatus))} />
            </div>
          </div>

          {/* Message list */}
          <div ref={messageListContainerRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/10 via-background to-muted/5 p-4">
            <MessageList
              messages={messages}
              isTyping={isGenerating}
              showTimeStamps={false}
              messageOptions={(message: ChatKitMessage) => {
                const meta = messageMeta[message.id];
                if (!meta?.badge) return {};
                return {
                  actions: (
                    <MessageBadge badge={meta.badge} label={meta.badgeLabel} />
                  ),
                };
              }}
            />

            {/* Progress indicator */}
            {progressMessage && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in-0 duration-300">
                <Loader2 className="size-3 animate-spin" />
                <span>{progressMessage}</span>
              </div>
            )}

            {/* Quick actions after last assistant message */}
            {lastMeta?.suggestedActions && lastMeta.suggestedActions.length > 0 && (
              <QuickActions actions={lastMeta.suggestedActions} onAction={handleQuickAction} />
            )}
          </div>

          {/* Input + status */}
          <div className="shrink-0 border-t border-border/40 bg-background/85 px-4 py-3 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                <span className={cn('size-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
                <span className="font-medium">{getConnectionLabel(connectionStatus)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={cn('font-mono text-[10px] tracking-wide', rateLimitColor)}>{rateLimitStatus.requestsLastMinute}/8</span>
                <span className="text-[10px] text-muted-foreground/30">|</span>
                <span className="text-[10px] text-muted-foreground/50">{messages.length} msg{messages.length === 1 ? '' : 's'}</span>
              </div>
            </div>
            <ChatForm className="w-full" isPending={isGenerating} handleSubmit={handleSubmit}>
              {({ files, setFiles }) => (
                <MessageInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Describe what you want to create or modify..."
                  onVoiceSend={(blob) => sendVoiceMessage(blob)}
                  allowAttachments
                  files={files}
                  setFiles={setFiles}
                  isGenerating={isGenerating}
                  stop={stopGenerating}
                />
              )}
            </ChatForm>
          </div>
        </Card>

        {/* ── FAB toggle button ── */}
        <Button
          type="button"
          size="icon"
          className={cn(
            'group relative size-14 rounded-2xl border bg-white/60 text-foreground shadow-elevation-2 backdrop-blur-sm transition-all duration-200 hover:shadow-elevation-3 active:scale-95 dark:bg-slate-800/40',
            isVisible
              ? 'border-brand/20 ring-1 ring-brand/15'
              : 'border-border/40 hover:border-brand/25 hover:bg-brand/5',
          )}
          onClick={() => setIsVisible((p) => !p)}
          title={isVisible ? 'Close assistant' : 'Open assistant'}
          aria-label={isVisible ? 'Close assistant' : 'Open assistant'}
        >
          {isVisible ? (
            <X className="size-5 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <>
              <img src={AGENT_AVATAR_SRC} alt="Agent" className="size-10 rounded-xl transition-transform duration-200 group-hover:scale-110" />
              {connectionStatus === 'connected' && (
                <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
              )}
            </>
          )}
        </Button>
      </div>

      {/* ── Disclaimer dialog ── */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="size-5" />
              Privacy and Data Processing
            </DialogTitle>
            <DialogDescription>
              Important information about how the assistant processes modeling data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">Data processing notice:</strong></p>
            <p>When you use the Modeling Assistant, your messages and diagram data are processed to provide AI-powered modeling support.</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Your diagram models and messages are sent to the AI service for processing.</li>
              <li>Data is transmitted over encrypted connections.</li>
              <li>Requests are processed to generate UML updates and modeling suggestions.</li>
              <li>Conversation history is stored locally in your current browser session.</li>
            </ul>
            <p><strong className="text-foreground">Privacy:</strong> Avoid sharing sensitive or confidential information in assistant messages.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowDisclaimer(false)}>I Understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  MessageBadge — small inline badge for injection/error/generation   */
/* ------------------------------------------------------------------ */

const BADGE_STYLES: Record<NonNullable<MessageMeta['badge']>, { icon: React.ReactNode; className: string }> = {
  injection: {
    icon: <Check className="size-3" />,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  error: {
    icon: <AlertTriangle className="size-3" />,
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  },
  generation: {
    icon: <Code className="size-3" />,
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
  },
};

const MessageBadge: React.FC<{ badge: NonNullable<MessageMeta['badge']>; label?: string }> = ({ badge, label }) => {
  const style = BADGE_STYLES[badge];
  if (!style) return null;
  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px] font-medium', style.className)}>
      {style.icon}
      {label || badge}
    </Badge>
  );
};
