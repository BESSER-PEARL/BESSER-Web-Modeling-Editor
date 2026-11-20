import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, Loader2, Plus, Square } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppSelector } from '../../app/store/hooks';
import type { LabChangeDetail } from '../../shared/api/lab';
import type { useAssistantLogic } from '../assistant';
import { formatUsd } from './LabChangeList';

type ChatLogic = ReturnType<typeof useAssistantLogic>;

export interface LabChatPaneProps {
  change: LabChangeDetail;
  /** The signed-in login. */
  viewer: string;
  /** The chat of the open change (`useAssistantLogic` in the lab build). */
  logic: ChatLogic;
  /** "+ New change": the home, its composer focused. */
  onNewChange: () => void;
  /** Stops the change's run in progress, whoever started it. */
  onStopRun: () => Promise<void>;
  className?: string;
}

/** The id of the conversation's latest lab run card when it is a plan: only that card offers "Build this plan". */
function latestPlanCard(messages: ChatKitMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const lab = messages[index].specDriven?.lab;
    if (lab) return lab.step === 'plan' ? messages[index].id : null;
  }
  return null;
}

/**
 * The chat of a change: its thread, rebuilt by the chat engine (`useAssistantLogic` in lab mode) and rendered the
 * way the assistant drawer renders it, with every sender named. A teammate is told that their messages continue the
 * owner's change. While a run of the change is in progress, for any viewer, the composer gives way to who runs it,
 * for how long and at what cost so far, and Stop.
 */
export const LabChatPane: React.FC<LabChatPaneProps> = ({ change, viewer, logic, onNewChange, onStopRun, className }) => {
  const { t, i18n } = useTranslation();
  const {
    messages,
    inputValue,
    setInputValue,
    isGenerating,
    progressSteps,
    lastSentMessage,
    messageListContainerRef,
    showScrollToBottom,
    scrollMessagesToBottom,
    handleSubmit,
    stopGenerating,
    openPullRequest,
    buildLabPlan,
    handleLabReviewAction,
  } = logic;
  const [stopping, setStopping] = useState(false);
  const run = change.run;
  // The live card of the run, when this tab follows it, knows what it has cost so far.
  const runCost = useAppSelector((state) =>
    run ? Object.values(state.specDriven.runs).find((card) => card.runId === run.runId)?.costUsd : undefined,
  );
  const draft = change.status === 'draft';
  const title = change.title || t('lab.change.newChange', { defaultValue: 'New change' });

  const latestPlanId = useMemo(() => latestPlanCard(messages), [messages]);
  const messageOptions = useCallback(
    (message: ChatKitMessage) => ({
      onOpenPullRequest: openPullRequest,
      onBuildPlan: message.id === latestPlanId ? buildLabPlan : undefined,
      onLabReviewAction: handleLabReviewAction,
    }),
    [openPullRequest, buildLabPlan, handleLabReviewAction, latestPlanId],
  );

  const stop = async () => {
    setStopping(true);
    try {
      await onStopRun();
    } finally {
      setStopping(false);
    }
  };

  const minutes = run ? Math.max(0, Math.floor((Date.now() / 1000 - run.startedAt) / 60)) : 0;
  const runningLine = run
    ? t(run.step === 'plan' ? 'lab.change.runningPlan' : 'lab.change.runningBuild', {
        defaultValue: run.step === 'plan' ? "@{{login}}'s plan is running ({{details}})." : "@{{login}}'s build is running ({{details}}).",
        login: run.login,
        details: [
          t('lab.change.runMinutes', { defaultValue: '{{count}} min', count: minutes }),
          ...(typeof runCost === 'number' ? [formatUsd(runCost, i18n.language)] : []),
        ].join(', '),
      })
    : '';

  return (
    <section
      aria-label={t('lab.change.chat', { defaultValue: 'Conversation' })}
      className={cn('flex min-h-0 flex-col bg-background', className)}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-medium text-foreground" title={title}>
          {draft
            ? t('lab.change.newChange', { defaultValue: 'New change' })
            : t('lab.change.chatTitle', { defaultValue: 'Change: {{title}}', title })}
        </h2>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onNewChange}>
          <Plus aria-hidden />
          {t('lab.change.newChangeButton', { defaultValue: 'New change' })}
        </Button>
      </div>
      {change.owner !== viewer && (
        <p data-testid="lab-change-continuation" className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {t('lab.change.continuation', {
            defaultValue: "@{{owner}}'s change. Your messages continue it and are signed with your login.",
            owner: change.owner,
          })}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={messageListContainerRef} className="h-full overflow-y-auto overscroll-contain px-4 py-5">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('lab.change.emptyChat', {
                defaultValue: 'Describe the change. The lab agent plans it first; you correct the plan, then build it.',
              })}
            </p>
          ) : (
            <MessageList
              messages={messages}
              isTyping={isGenerating && !run}
              typingLabel={progressSteps.length > 0 ? progressSteps[progressSteps.length - 1] : undefined}
              showTimeStamps={false}
              messageOptions={messageOptions}
            />
          )}
        </div>
        {showScrollToBottom && (
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-3 left-1/2 size-8 -translate-x-1/2 rounded-full shadow-sm"
            aria-label={t('lab.change.scrollToBottom', { defaultValue: 'Scroll to the latest message' })}
            onClick={scrollMessagesToBottom}
          >
            <ArrowDown aria-hidden />
          </Button>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        {run ? (
          <div data-testid="lab-change-running" className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
              <span className="min-w-0">{runningLine}</span>
            </p>
            <Button variant="outline" size="sm" disabled={stopping} onClick={() => void stop()}>
              <Square aria-hidden />
              {t('lab.change.stop', { defaultValue: 'Stop' })}
            </Button>
          </div>
        ) : (
          <ChatForm isPending={isGenerating} handleSubmit={handleSubmit}>
            {() => (
              <MessageInput
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={
                  draft
                    ? t('lab.change.placeholderDraft', { defaultValue: 'Describe the change...' })
                    : t('lab.change.placeholder', { defaultValue: 'Message about ‘{{title}}’...', title })
                }
                stop={stopGenerating}
                isGenerating={isGenerating}
                lastSentMessage={lastSentMessage}
                onValueChange={setInputValue}
              />
            )}
          </ChatForm>
        )}
      </div>
    </section>
  );
};
