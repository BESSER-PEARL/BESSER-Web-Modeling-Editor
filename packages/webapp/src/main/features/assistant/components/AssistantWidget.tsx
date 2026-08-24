/**
 * AssistantWidget — floating chat widget that delegates all business logic
 * to the shared useAssistantLogic hook.
 *
 * Renders as a fixed FAB button in the bottom-right corner that toggles a
 * popup chat card.  Route-aware: only visible on editor pages and implements
 * diagram switching via route navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, Check, CircleHelp, Code, Flag, KeyRound, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { selectActiveDiagramType, switchDiagramTypeThunk } from '../../../app/store/workspaceSlice';
import { openPushDialog } from '../../smart-generation/state/smartGeneratorSlice';
import type { SupportedDiagramType } from '../../../shared/types/project';
import { readLlmKey } from '../../../shared/services/llmKeyStorage';
import type { GeneratorType } from '../../../app/shell/workspace-types';
import type { GenerationResult } from '../../generation/types';
import { useAssistantLogic, type ConnectionStatus, type MessageMeta } from '../hooks/useAssistantLogic';
import { shouldOpenGuiTab, isReviewSpecAction, type GuiActionRouteInput } from '../hooks/suggestedActionRouting';
import { AssistantByokDialog } from './AssistantByokDialog';
import { QuickActions } from './QuickActions';
import { ProgressSteps } from './ProgressSteps';
import { Z_INDEX } from '../../../shared/constants/z-index';

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

const getConnectionLabelKey = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'assistant.connection.connected';
    case 'connecting':
      return 'common.connecting';
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
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AssistantWidgetProps {
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ onAssistantGenerate }) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  // Reflect whether a BYOK key is saved (re-reads when the dialog closes).
  const savedApiKey = readLlmKey();

  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const activeDiagramType = useAppSelector(selectActiveDiagramType);

  const isOnEditorPage = location.pathname === '/';
  // The modeling assistant is UML-oriented and has no reasoning over NN
  // architectures; hide it entirely on the NN diagram so users aren't tempted
  // to ask it about layers / hyperparameters / training.
  const isAssistantApplicable = activeDiagramType !== 'NNDiagram';

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
    progressSteps,
    lastSentMessage,
    messageListContainerRef,
    showScrollToBottom,
    scrollMessagesToBottom,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    reportIssue,
    assistantClient,
  } = useAssistantLogic({
    isActive: isVisible,
    switchDiagram,
    onGenerate: onAssistantGenerate,
  });

  /* ---- Quick action handler: submit a prompt directly ---- */
  const handleQuickAction = useCallback((prompt: string) => {
    handleSubmit(undefined, { overrideText: prompt });
  }, [handleSubmit]);

  /* ---- Suggested-action chip handler: route "modify the GUI" to the GUI tab ---- */
  const handleSuggestedAction = useCallback((action: GuiActionRouteInput) => {
    // "Review the spec" hides the widget so the diagram on the canvas is
    // visible — it's a UI-only action, never relayed to the agent.
    if (isReviewSpecAction(action)) {
      setIsVisible(false);
      return;
    }
    if (shouldOpenGuiTab(action)) {
      void switchDiagram('GUINoCodeDiagram');
      return;
    }
    handleSubmit(undefined, { overrideText: action.prompt ?? '' });
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

  /* ---- Hide when not on an editor page or on a non-applicable diagram ---- */

  useEffect(() => {
    if (!isOnEditorPage || !isAssistantApplicable) {
      setIsVisible(false);
    }
  }, [isOnEditorPage, isAssistantApplicable]);

  /* ---- External toggle event ---- */

  useEffect(() => {
    const toggle = () => {
      if (!isOnEditorPage || !isAssistantApplicable) return;
      setIsVisible((p) => !p);
    };
    window.addEventListener('besser:toggle-agent-widget', toggle);
    return () => window.removeEventListener('besser:toggle-agent-widget', toggle);
  }, [isOnEditorPage, isAssistantApplicable]);

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

  if (!isOnEditorPage || !isAssistantApplicable || drawerOpen) return null;

  const rateLimitColor =
    rateLimitStatus.cooldownRemaining > 0 || rateLimitStatus.requestsLastMinute >= 8
      ? 'text-red-500'
      : rateLimitStatus.requestsLastMinute >= 6
        ? 'text-amber-500'
        : 'text-muted-foreground';

  return (
    <>
      {/* ── Floating widget container ── */}
      <div className="fixed bottom-5 right-4 md:right-16" style={{ zIndex: Z_INDEX.NOTIFICATION, marginRight: 'var(--properties-panel-width, 0px)', transition: 'margin-right 0.2s ease' }}>
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
                <img src={AGENT_AVATAR_SRC} alt={t('assistant.agentAvatarAlt')} className="size-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none tracking-tight text-foreground">{t('assistant.modelingAssistant')}</p>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground/60">{t('assistant.byBesser')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'relative size-7 rounded-lg transition-colors hover:bg-brand/5 hover:text-foreground',
                  savedApiKey ? 'text-brand' : 'text-muted-foreground/60',
                )}
                onClick={() => setByokOpen(true)}
                title={
                  savedApiKey
                    ? `Your ${savedApiKey.provider} API key is set — click to change or remove`
                    : 'Use your own API key (assistant + generator)'
                }
                aria-label={savedApiKey ? 'API key set — click to change' : 'Use your own API key'}
              >
                <KeyRound className="size-3.5" />
                {savedApiKey ? (
                  <Check className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-background text-brand" />
                ) : null}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground/60 transition-colors hover:bg-brand/5 hover:text-foreground"
                onClick={() => reportIssue()}
                title="Report an issue — export this conversation and context for the BESSER team"
                aria-label="Report an issue"
              >
                <Flag className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground/60 transition-colors hover:bg-brand/5 hover:text-foreground"
                onClick={() => setShowDisclaimer(true)}
                title={t('assistant.privacy.iconLabel')}
                aria-label={t('assistant.privacy.iconLabel')}
              >
                <CircleHelp className="size-3.5" />
              </Button>
              <span className={cn('size-2 rounded-full', getConnectionDotClass(connectionStatus))} />
            </div>
          </div>

          {/* Message list */}
          <div className="relative min-h-0 flex-1">
          <div ref={messageListContainerRef} className="h-full overflow-y-auto bg-gradient-to-b from-muted/10 via-background to-muted/5 p-4">
            {messages.length === 0 && !isGenerating ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-brand/8 ring-1 ring-brand/10">
                  <img src={AGENT_AVATAR_SRC} alt={t('assistant.agentAvatarAlt')} className="size-9 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('assistant.welcome.greeting')}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {t('assistant.welcome.intro')}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full max-w-xs">
                  {[
                    t('assistant.welcome.suggestions.library'),
                    t('assistant.welcome.suggestions.payment'),
                    t('assistant.welcome.suggestions.django'),
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-lg border border-border/50 bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-foreground"
                      onClick={() => handleQuickAction(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                {/* Free-tier promo — no API key needed; link opens the shared BYOK dialog */}
                <p className="text-[11px] text-muted-foreground">
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
            ) : (
            <MessageList
              messages={messages}
              isTyping={isGenerating}
              showTimeStamps={false}
              messageOptions={(message: ChatKitMessage) => {
                const meta = messageMeta[message.id];
                // onPushToGithub is always threaded so SmartGenCards can push;
                // the badge action is added only when the message has one.
                // Opening the push dialog is a pure dispatch — it's mounted
                // app-level (SmartGenPushDialogHost) and Redux-driven.
                const base = { onPushToGithub: (runId: string) => dispatch(openPushDialog(runId)) };
                if (!meta?.badge) return base;
                return {
                  ...base,
                  actions: (
                    <MessageBadge badge={meta.badge} label={meta.badgeLabel} />
                  ),
                };
              }}
            />
            )}

            {/* Progress indicator — evolving step list so long operations
                visibly show motion. Clears automatically on completion. */}
            <ProgressSteps steps={progressSteps} />

            {/* Quick actions after last assistant message */}
            {lastMeta?.suggestedActions && lastMeta.suggestedActions.length > 0 && (
              <QuickActions actions={lastMeta.suggestedActions} onAction={handleSuggestedAction} />
            )}

            {/* Limit reached / auth error → offer the user their own key */}
            {lastMeta?.needsApiKey && (
              <div className="mt-2 flex justify-start">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg bg-brand text-brand-foreground hover:bg-brand-dark"
                  onClick={() => setByokOpen(true)}
                >
                  <KeyRound className="size-3.5" />
                  Add your API key
                </Button>
              </div>
            )}
          </div>
          {/* Scroll-to-bottom — shown while the user has scrolled up;
              streaming no longer force-follows their position */}
          {showScrollToBottom && (
            <button
              type="button"
              aria-label="Scroll to bottom"
              onClick={scrollMessagesToBottom}
              className="absolute bottom-3 right-4 z-10 rounded-full border border-border/60 bg-background/95 p-2 text-muted-foreground shadow-md backdrop-blur transition-colors hover:bg-muted hover:text-foreground animate-in fade-in-0 slide-in-from-bottom-1"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
          </div>

          {/* Input + status */}
          <div className="shrink-0 border-t border-border/40 bg-background/85 px-4 py-3 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                <span className={cn('size-1.5 rounded-full', getConnectionDotClass(connectionStatus))} />
                <span className="font-medium">{t(getConnectionLabelKey(connectionStatus))}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={cn('font-mono text-[10px] tracking-wide', rateLimitColor)}>{rateLimitStatus.requestsLastMinute}/8</span>
                <span className="text-[10px] text-muted-foreground/30">|</span>
                <span className="text-[10px] text-muted-foreground/50">{t('assistant.messageCount', { count: messages.length })}</span>
              </div>
            </div>
            <ChatForm className="w-full" isPending={isGenerating} handleSubmit={handleSubmit}>
              {({ files, setFiles }) => (
                <MessageInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={t('assistant.composer.placeholder')}
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
          title={isVisible ? t('assistant.fab.close') : t('assistant.fab.open')}
          aria-label={isVisible ? t('assistant.fab.close') : t('assistant.fab.open')}
        >
          {isVisible ? (
            <X className="size-5 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <>
              <img src={AGENT_AVATAR_SRC} alt={t('assistant.agentAvatarAlt')} className="size-10 rounded-xl transition-transform duration-200 group-hover:scale-110" />
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
              {t('assistant.privacy.title')}
            </DialogTitle>
            <DialogDescription>
              {t('assistant.privacy.subtitle')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">{t('assistant.privacy.noticeHeading')}</strong></p>
            <p>{t('assistant.privacy.body')}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>{t('assistant.privacy.bullets.sent')}</li>
              <li>{t('assistant.privacy.bullets.encrypted')}</li>
              <li>{t('assistant.privacy.bullets.processed')}</li>
              <li>{t('assistant.privacy.bullets.stored')}</li>
            </ul>
            <p><strong className="text-foreground">{t('assistant.privacy.privacyLabel')}</strong> {t('assistant.privacy.privacyBody')}</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowDisclaimer(false)}>{t('assistant.privacy.understand')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bring-your-own-key dialog ── */}
      <AssistantByokDialog open={byokOpen} onOpenChange={setByokOpen} client={assistantClient} />

      {/* Push-to-GitHub dialog is mounted app-level (SmartGenPushDialogHost) and
          opened via dispatch(openPushDialog(runId)) — see messageOptions above. */}
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
