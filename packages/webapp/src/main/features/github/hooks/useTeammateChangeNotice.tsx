/** Tells the user, once per new head of the linked branch, when someone else's commits arrive. */
import React, { useEffect, useRef } from 'react';
import { Slide, toast } from 'react-toastify';
import type { SyncStatus } from '../../../shared/api/github';
import type { ProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import {
  TeammateChangeNotice,
  type TeammateChange,
  type TeammateChangeAction,
} from '../components/TeammateChangeNotice';
import type { RepoSyncState } from './useRepoSync';

const NOTICE_TOAST_ID = 'github-teammate-change';

/** The newest commit someone else made, from `commits` (newest first); null when all are the user's own. */
export function teammateChange(commits: SyncStatus['commits_since'], username?: string): TeammateChange | null {
  const own = username?.toLowerCase();
  const latest = commits.find((commit) => commit.author.toLowerCase() !== own);
  if (!latest) return null;
  return {
    author: latest.author,
    subject: latest.message.split('\n')[0],
    changedModel: latest.origin === 'editor',
    moreCommits: commits.length - 1,
  };
}

export function useTeammateChangeNotice({
  link,
  status,
  state,
  username,
  hasLocalChanges,
  onAction,
}: {
  link: ProjectGitHubLink | null;
  status: SyncStatus | null;
  state: RepoSyncState;
  username?: string;
  hasLocalChanges: boolean;
  onAction: (action: TeammateChangeAction) => void;
}) {
  const announced = useRef<string | null>(null);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const newCommits = state === 'behind' || state === 'diverged';
  const headSha = newCommits ? status?.head_sha : undefined;

  useEffect(() => {
    const change = headSha && status ? teammateChange(status.commits_since, username) : null;
    if (!change || !link) {
      toast.dismiss(NOTICE_TOAST_ID);
      return;
    }
    const card = (
      <TeammateChangeNotice
        change={change}
        repoName={`${link.owner}/${link.repo}`}
        branch={link.branch}
        hasLocalChanges={hasLocalChanges}
        onAction={(action) => onActionRef.current(action)}
      />
    );
    const head = `${link.owner}/${link.repo}@${link.branch}#${headSha}`;
    if (toast.isActive(NOTICE_TOAST_ID)) {
      toast.update(NOTICE_TOAST_ID, { render: card });
    } else if (announced.current !== head) {
      // Stays until answered: a teammate's change must not vanish while the user looks elsewhere.
      toast(card, {
        toastId: NOTICE_TOAST_ID,
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        icon: false,
        role: 'status',
        transition: Slide,
        className: '!min-h-0 !p-0',
        bodyClassName: '!m-0 !block !p-0',
      });
    }
    announced.current = head;
  }, [headSha, status, link, username, hasLocalChanges]);
}
