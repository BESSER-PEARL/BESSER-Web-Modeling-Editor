import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Github, Loader2 } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { switchDiagramTypeThunk } from '../../app/store/workspaceSlice';
import {
  dropActiveLabChange,
  getLabState,
  openLabPullRequests,
  parkLabChange,
  resetLabPreview,
  resumeLabChange,
  type LabPullRequestsResponse,
  type LabState,
} from '../../shared/api/lab';
import { cancelSpecDrivenRun } from '../../shared/api/specDriven';
import { useGitHubAuth } from '../../shared/hooks/useGitHubAuth';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { reportError } from '../../shared/services/errors/reportError';
import { getLabEnabled, isLabConfigKnown, peekLabEnabled } from '../../shared/services/labConfig';
import type { SupportedDiagramType } from '../../shared/types/project';
import { describeNetworkError } from '../../shared/utils/describeNetworkError';
import { useAssistantLogic } from '../assistant';
import { selectHasLiveSpecDrivenRun } from '../spec-driven';
import { LabStatePanel } from './LabStatePanel';

/**
 * BESSER Lab without the diagram canvas: the working copy's state, the actions on
 * the change, and the lab chat. It still works when a change breaks the editor.
 */
export const LabPage: React.FC = () => {
  const { t } = useTranslation();
  // null until the server config says whether this instance is a lab; 'unreachable' when it could not be read.
  const [enabled, setEnabled] = useState<boolean | null | 'unreachable'>(() => (peekLabEnabled() ? true : null));
  const [attempt, setAttempt] = useState(0);
  const { githubSession, isChecking, login } = useGitHubAuth();

  useEffect(() => {
    let cancelled = false;
    void getLabEnabled().then((value) => {
      if (!cancelled) setEnabled(value || isLabConfigKnown() ? value : 'unreachable');
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (enabled === 'unreachable') {
    return (
      <CenteredNote>
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p>{t('lab.unreachable', { defaultValue: 'The server could not be reached, so it is not known whether BESSER Lab runs here.' })}</p>
          <Button
            variant="outline"
            onClick={() => {
              setEnabled(null);
              setAttempt((n) => n + 1);
            }}
          >
            {t('lab.retry', { defaultValue: 'Try again' })}
          </Button>
        </div>
      </CenteredNote>
    );
  }
  if (enabled === null || (enabled && isChecking)) {
    return (
      <CenteredNote>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('lab.loading', { defaultValue: 'Loading the lab…' })}
      </CenteredNote>
    );
  }
  if (!enabled) {
    return <CenteredNote>{t('lab.disabled', { defaultValue: 'BESSER Lab is not enabled on this instance.' })}</CenteredNote>;
  }
  if (!githubSession) {
    return (
      <CenteredNote>
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p>{t('lab.signInPrompt', { defaultValue: 'Sign in with GitHub to use BESSER Lab.' })}</p>
          <Button onClick={() => login('lab_page')}>
            <Github className="size-4" />
            {t('lab.signIn', { defaultValue: 'Sign in with GitHub' })}
          </Button>
        </div>
      </CenteredNote>
    );
  }
  return <LabWorkspace githubSession={githubSession} />;
};

const LabWorkspace: React.FC<{ githubSession: string }> = ({ githubSession }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [state, setState] = useState<LabState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loads, setLoads] = useState(0);
  const [opened, setOpened] = useState<LabPullRequestsResponse | null>(null);
  // The panel's last "Open pull request" failure, for the change it was about.
  const [pullRequestFailure, setPullRequestFailure] = useState<{ error: unknown; changeId: string } | null>(null);
  const [stoppingRunId, setStoppingRunId] = useState<string | null>(null);
  const [actionRunning, setActionRunning] = useState(false);

  // Same as the floating assistant: a diagram lives on the editor page.
  const switchDiagram = useCallback(
    async (targetType: string): Promise<boolean> => {
      navigate('/');
      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: targetType as SupportedDiagramType })).unwrap();
        return true;
      } catch {
        return false;
      }
    },
    [dispatch, navigate],
  );

  const {
    messages,
    inputValue,
    setInputValue,
    isGenerating,
    progressSteps,
    messageListContainerRef,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    latestRunId,
    buildLabPlan,
  } = useAssistantLogic({ isActive: true, switchDiagram, surface: 'workspace' });
  // `isGenerating` is cleared once a run's card appears; the run itself is in flight until the card is final.
  const runInFlight = useAppSelector((s) => s.specDriven.runStatus !== 'idle' || selectHasLiveSpecDrivenRun(s));
  const running = isGenerating || runInFlight;

  /** Runs one lab action; its failure is reported with the action's own name. */
  const runAction = useCallback(
    async (label: string, action: () => Promise<LabState | void>) => {
      setActionRunning(true);
      try {
        const next = await action();
        if (next) setState(next);
      } catch (error) {
        reportError(
          t('lab.errors.actionFailed', {
            defaultValue: '{{action}} failed: {{error}}',
            action: label,
            error: describeNetworkError(error),
          }),
          { error },
        );
      } finally {
        setActionRunning(false);
      }
    },
    [t],
  );

  // On opening the page, after every run (a run changes the working copy) and on Try again.
  // A failure is shown in place of the state, which is what the page's actions need.
  useEffect(() => {
    if (running) return;
    let cancelled = false;
    setLoadError(null);
    getLabState(githubSession).then(
      (next) => {
        if (!cancelled) setState(next);
      },
      (error: unknown) => {
        if (!cancelled) setLoadError(describeNetworkError(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [running, githubSession, loads]);

  // For change `changeId` (a run card's, or the active one's in the panel): the server acts on the active change.
  // Rejects with the failure, which the card or the panel that asked shows in place.
  const openPullRequest = useCallback(
    async (changeId: string) => {
      setActionRunning(true);
      try {
        const response = await openLabPullRequests(githubSession, changeId);
        if (response === null) {
          throw new Error(
            t('lab.chat.notActiveChange', {
              defaultValue:
                'No pull request was opened: this card’s change is not the active one. Resume it on the lab page first.',
            }),
          );
        }
        setOpened(response);
      } finally {
        setActionRunning(false);
      }
      // The pull requests are open; a failed re-read is the state's failure, not theirs.
      getLabState(githubSession).then(setState, (error: unknown) => setLoadError(describeNetworkError(error)));
    },
    [githubSession, t],
  );

  // The run `GET /lab/state` names: this tab may not be the one following it (another tab or device).
  const stopRun = useCallback(
    (runId: string) =>
      runAction(t('lab.actions.stopRun', { defaultValue: 'Stop the run' }), async () => {
        if (!(await cancelSpecDrivenRun(runId, { githubSession }))) {
          throw new Error(t('lab.errors.stopNotAccepted', { defaultValue: 'the server did not accept the request.' }));
        }
        setStoppingRunId(runId);
        return getLabState(githubSession);
      }),
    [githubSession, runAction, t],
  );

  const drop = useCallback(async () => {
    const confirmed = await globalConfirm({
      title: t('lab.drop.confirmTitle', { defaultValue: 'Drop this change?' }),
      description: t('lab.drop.confirmDescription', {
        defaultValue: 'Its branches and notes are deleted from the working copy. Work not in a pull request is lost.',
      }),
      confirmLabel: t('lab.actions.drop', { defaultValue: 'Drop' }),
      variant: 'danger',
    });
    if (!confirmed) return;
    setOpened(null);
    await runAction(t('lab.actions.drop', { defaultValue: 'Drop' }), () => dropActiveLabChange(githubSession));
  }, [githubSession, runAction, t]);

  const busy = actionRunning || running;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="shrink-0 overflow-y-auto border-b border-border/40 px-6 py-5 lg:w-96 lg:border-b-0 lg:border-r">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
            <FlaskConical className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{t('lab.title', { defaultValue: 'BESSER Lab' })}</h1>
            <p className="text-sm text-muted-foreground">
              {t('lab.description', { defaultValue: "Changes to BESSER's own code, on lab branches." })}
            </p>
          </div>
        </div>
        {loadError ? (
          <div role="alert" className="mb-4 space-y-2 text-sm text-destructive">
            <p>
              {t('lab.loadStateFailed', {
                defaultValue: 'The lab state could not be read: {{error}}',
                error: loadError,
              })}
            </p>
            <Button size="sm" variant="outline" onClick={() => setLoads((n) => n + 1)}>
              {t('lab.retry', { defaultValue: 'Try again' })}
            </Button>
          </div>
        ) : null}
        {state ? (
          <LabStatePanel
            state={state}
            busy={busy}
            pullRequests={opened?.pullRequests ?? []}
            checksNote={opened?.checksNote ?? ''}
            pullRequestFailure={pullRequestFailure?.changeId === state.change?.changeId ? pullRequestFailure : null}
            onOpenPullRequest={() => {
              if (!state.change) return;
              const { changeId } = state.change;
              setPullRequestFailure(null);
              openPullRequest(changeId).catch((error: unknown) => setPullRequestFailure({ error, changeId }));
            }}
            onStopRun={(runId) => void stopRun(runId)}
            stoppingRunId={stoppingRunId}
            onPark={() =>
              void runAction(t('lab.actions.park', { defaultValue: 'Park' }), () => parkLabChange(githubSession))
            }
            onDrop={drop}
            onResume={(changeId) =>
              void runAction(t('lab.actions.resume', { defaultValue: 'Resume' }), () =>
                resumeLabChange(githubSession, changeId),
              )
            }
            onResetPreview={() =>
              void runAction(t('lab.actions.resetPreview', { defaultValue: 'Reset the editor to development' }), () =>
                resetLabPreview(githubSession),
              )
            }
          />
        ) : loadError ? null : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('lab.loadingState', { defaultValue: 'Reading the working copy…' })}
          </p>
        )}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={t('lab.chatLabel', { defaultValue: 'Lab chat' })}>
        <div ref={messageListContainerRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && !isGenerating ? (
            <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted-foreground">
              {t('lab.chatEmpty', {
                defaultValue: 'Describe a change to BESSER, the web editor or the modeling agent. The lab agent plans it first.',
              })}
            </p>
          ) : (
            <MessageList
              messages={messages}
              isTyping={isGenerating}
              typingLabel={progressSteps.length > 0 ? progressSteps[progressSteps.length - 1] : undefined}
              showTimeStamps={false}
              messageOptions={(message) => ({
                onOpenPullRequest: openPullRequest,
                // Only the latest card's plan is the one to build.
                onBuildPlan: message.specDriven?.runId === latestRunId ? buildLabPlan : undefined,
              })}
            />
          )}
        </div>
        <div className="shrink-0 border-t border-border/40 px-4 py-3 sm:px-6">
          {state ? (
            <p className="mb-2 text-xs text-muted-foreground">
              {state.change
                ? t('lab.composerTarget', {
                    defaultValue: 'Active change: “{{title}}”. Park it to start a separate change.',
                    title: state.change.title,
                  })
                : t('lab.composerNewChange', { defaultValue: 'Your next message starts a new change.' })}
            </p>
          ) : null}
          <ChatForm className="w-full" isPending={isGenerating} handleSubmit={handleSubmit}>
            {() => (
              <MessageInput
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('lab.composerPlaceholder', { defaultValue: 'Describe the change…' })}
                onVoiceSend={(blob) => sendVoiceMessage(blob)}
                isGenerating={isGenerating}
                stop={stopGenerating}
              />
            )}
          </ChatForm>
        </div>
      </section>
    </div>
  );
};

const CenteredNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-full items-center justify-center gap-2 p-8 text-sm text-muted-foreground">{children}</div>
);
