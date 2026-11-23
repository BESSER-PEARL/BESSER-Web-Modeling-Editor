/**
 * A change's thread (`LabChangeDetail.thread`, BESSER `services/lab/thread.py`) as the chat shows it: what each
 * login said, the card of each finished run (with its plan version), the pull requests opened for the change and
 * the notices every viewer sees. The chat of a change is rebuilt from it, so a reload, another browser or a
 * teammate sees the same conversation; nothing of it is kept in the browser.
 */
import { labRepoName, labRunDetails } from '@/components/chatbot-kit/ui/lab-run-result';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { SpecDrivenMessageState } from '../spec-driven';
import type { LabDone, LabPullRequest, LabThreadItem, LabThreadRun } from '../../shared/api/lab';
import i18n from '../../shared/i18n';

type LabCardView = NonNullable<SpecDrivenMessageState['lab']>;

/** A run of the change still in progress: the chat follows it through its durable event log. */
export interface LabRunInProgress {
  runId: string;
  login: string;
  /** Milliseconds since the epoch. */
  startedAt: number;
}

const toDate = (at: number): Date => new Date(at * 1000);

/** The card's part of a run's result; the proposed model goes into the change's project, not the chat. */
function cardView(lab: LabDone): LabCardView {
  const { step, changeId, title, kind, plan, repoChanges, checks, checklist, summary, stopReason, finalText } = lab;
  return { step, changeId, title, kind, plan, repoChanges, checks, checklist, summary, stopReason, finalText };
}

/** A chat line listing pull requests: `heading`, one link per pull request, then which checks they passed. */
export function pullRequestsText(heading: string, pullRequests: LabPullRequest[], checksNote: string): string {
  return [
    heading,
    ...pullRequests.map(
      (pr) =>
        `- [${labRepoName(i18n.t, pr.repo)} #${pr.number}](${pr.url}): \`${pr.branch}\` into \`${pr.base}\``,
    ),
    ...(checksNote ? ['', checksNote] : []),
  ].join('\n');
}

function runMessage(item: LabThreadRun): ChatKitMessage | null {
  const base = { id: `run-${item.runId}`, role: 'assistant', content: '', createdAt: toDate(item.at) };
  if (item.lab) {
    const card: SpecDrivenMessageState = {
      runId: item.runId,
      phases: [],
      warnings: [],
      text: '',
      status: 'done',
      isLabRun: true,
      lab: cardView(item.lab),
      ...(item.costUsd !== null ? { costUsd: item.costUsd } : {}),
    };
    return { ...base, specDriven: card, labRun: labRunDetails(item.lab, item.planVersion) };
  }
  if (item.status === 'failed') {
    const line = i18n.t('lab.chat.runError', {
      defaultValue: 'BESSER Forge error ({{code}}): {{message}}',
      code: item.error?.code ?? 'INTERNAL',
      message: item.error?.message ?? '',
    });
    return { ...base, content: `❌ ${line}`, isError: true };
  }
  if (item.status === 'cancelled') {
    return { ...base, content: `⏹ ${i18n.t('lab.chat.stopped', { defaultValue: 'BESSER Forge run stopped by user.' })}` };
  }
  // A run in progress has no card here: following it makes its live card (`labRunInProgress`).
  return null;
}

/**
 * The thread as chat messages, oldest first. `viewer` is the signed-in login: their messages are their own (right
 * side), everyone else's carry the sender's login. A run in progress is left out; `labRunInProgress` names it.
 */
export function threadToMessages(thread: LabThreadItem[], viewer?: string | null): ChatKitMessage[] {
  const messages: ChatKitMessage[] = [];
  for (const item of thread) {
    switch (item.type) {
      case 'message':
        messages.push({
          id: item.id,
          role: 'user',
          content: item.text,
          createdAt: toDate(item.at),
          sender: { login: item.login, self: item.login === viewer },
        });
        continue;
      case 'run': {
        const message = runMessage(item);
        if (message) messages.push(message);
        continue;
      }
      case 'pull_requests':
        messages.push({
          id: `pull-requests-${item.at}`,
          role: 'assistant',
          content: pullRequestsText(
            i18n.t('lab.chat.pullRequestsBy', {
              defaultValue: '@{{login}} opened or updated the draft pull requests:',
              login: item.login,
            }),
            item.pullRequests,
            item.checksNote,
          ),
          createdAt: toDate(item.at),
        });
        continue;
      case 'notice':
        messages.push({
          id: `notice-${item.at}`,
          role: 'assistant',
          content: item.text,
          createdAt: toDate(item.at),
          isNotice: true,
        });
        continue;
    }
  }
  return messages;
}

/** The thread's run still in progress, if any (only the newest run can be). */
export function labRunInProgress(thread: LabThreadItem[]): LabRunInProgress | null {
  for (let index = thread.length - 1; index >= 0; index -= 1) {
    const item = thread[index];
    if (item.type !== 'run') continue;
    return item.status === 'running' ? { runId: item.runId, login: item.login, startedAt: item.at * 1000 } : null;
  }
  return null;
}

/**
 * The thread's messages with the ones this tab added that the thread does not hold (a message sent before the
 * thread was read, a live run card, a review card), in time order. What the thread holds is shown in its copy:
 * an own message of the same text, a card of the same run, an item of the same id.
 */
export function mergeThreadMessages(fromThread: ChatKitMessage[], local: ChatKitMessage[]): ChatKitMessage[] {
  const ids = new Set(fromThread.map((m) => m.id));
  const runs = new Set(fromThread.map((m) => m.specDriven?.runId).filter(Boolean));
  const ownTexts = new Set(fromThread.filter((m) => m.role === 'user' && m.sender?.self).map((m) => m.content));
  const added = local.filter(
    (m) =>
      !ids.has(m.id) &&
      !(m.specDriven?.runId && runs.has(m.specDriven.runId)) &&
      !(m.role === 'user' && !m.sender && ownTexts.has(m.content)),
  );
  const time = (m: ChatKitMessage) => m.createdAt?.getTime() ?? 0;
  // A stable sort: messages of the same time keep their order, the thread's first.
  return [...fromThread, ...added].sort((a, b) => time(a) - time(b));
}
