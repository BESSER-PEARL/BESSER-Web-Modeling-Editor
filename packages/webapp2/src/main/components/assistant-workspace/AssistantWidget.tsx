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
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '../../store/hooks';
import { switchDiagramTypeThunk } from '../../services/workspace/workspaceSlice';
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
      return 'bg-amber-500';
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
    setInputValue(prompt);
    // Use a microtask so the inputValue state settles before submit reads it.
    queueMicrotask(() => {
      handleSubmit();
    });
  }, [handleSubmit, setInputValue]);

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

  /* ---- Render ---- */

  if (!isOnEditorPage) return null;

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
            'absolute bottom-[74px] right-0 flex h-[min(78vh,700px)] w-[min(96vw,520px)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-elevation-3 transition-all duration-300 sm:w-[480px] lg:w-[520px]',
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-4 py-3.5 text-white dark:from-slate-800 dark:via-slate-800 dark:to-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-sm ring-1 ring-white/20">
                <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none tracking-tight">Modeling Assistant</p>
                <p className="mt-1 text-[11px] font-medium text-white/60">by BESSER</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setShowDisclaimer(true)}
                title="Privacy and data processing"
                aria-label="Privacy and data processing"
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </Button>
              <span className={cn('h-2 w-2 rounded-full ring-2 ring-current/15', getConnectionDotClass(connectionStatus))} />
            </div>
          </div>

          {/* Message list */}
          <div ref={messageListContainerRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 dark:from-slate-900/60 dark:to-slate-950/40">
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
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in-0 duration-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{progressMessage}</span>
              </div>
            )}

            {/* Quick actions after last assistant message */}
            {lastMeta?.suggestedActions && lastMeta.suggestedActions.length > 0 && (
              <QuickActions actions={lastMeta.suggestedActions} onAction={handleQuickAction} />
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
              <span className="font-medium">{getConnectionLabel(connectionStatus)}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] tracking-wide">
              <span className={rateLimitColor}>{rateLimitStatus.requestsLastMinute}/8</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{messages.length} msg{messages.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border/30 bg-background p-3">
            <ChatForm className="w-full" isPending={isGenerating} handleSubmit={handleSubmit}>
              {({ files, setFiles }) => (
                <MessageInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Describe what you want to create or modify\u2026"
                  transcribeAudio={async (blob) => {
                    await sendVoiceMessage(blob);
                    return '';
                  }}
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
            'group h-14 w-14 rounded-2xl border bg-white text-slate-900 shadow-elevation-3 transition-all duration-300 hover:scale-105 hover:shadow-glow dark:bg-slate-900 dark:text-slate-100',
            isVisible
              ? 'border-slate-300/80 dark:border-slate-600'
              : 'border-slate-200/80 dark:border-slate-700',
          )}
          onClick={() => setIsVisible((p) => !p)}
          title={isVisible ? 'Close assistant' : 'Open assistant'}
          aria-label={isVisible ? 'Close assistant' : 'Open assistant'}
        >
          {isVisible ? (
            <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-10 w-10 rounded-xl transition-transform duration-200 group-hover:scale-110" />
          )}
        </Button>
      </div>

      {/* ── Disclaimer dialog ── */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5" />
              Privacy and Data Processing
            </DialogTitle>
            <DialogDescription>
              Important information about how the assistant processes modeling data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">Data processing notice:</strong></p>
            <p>When you use the Modeling Assistant, your messages and diagram data are processed to provide AI-powered modeling support.</p>
            <ul className="list-disc space-y-1 pl-5">
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
    icon: <Check className="h-3 w-3" />,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  error: {
    icon: <AlertTriangle className="h-3 w-3" />,
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  },
  generation: {
    icon: <Code className="h-3 w-3" />,
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
  },
};

const MessageBadge: React.FC<{ badge: NonNullable<MessageMeta['badge']>; label?: string }> = ({ badge, label }) => {
  const style = BADGE_STYLES[badge];
  if (!style) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', style.className)}>
      {style.icon}
      {label || badge}
    </span>
  );
};
