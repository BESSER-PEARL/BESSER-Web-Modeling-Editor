/**
 * The team notes a build proposes (`LabDone.noteProposals`), on its run card. Any lab user may keep one, after
 * editing its title and text (`createLabNote` with `fromProposal`, so the server records who approved it and stops
 * offering it), or dismiss it (`dismissLabNoteProposal`). A refusal stays on the proposal until the next attempt.
 */
import React, { useId, useState } from 'react';
import { BookmarkPlus, Check, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createLabNote,
  dismissLabNoteProposal,
  labRefusal,
  type LabNoteProposal,
  type LabRepoKey,
} from '../../shared/api/lab';
import { getGitHubSession } from '../../shared/services/github/githubAuth';

const REPO_KEYS: readonly string[] = ['besser', 'frontend', 'modeling_agent'] satisfies LabRepoKey[];
const isRepoKey = (repo: string): repo is LabRepoKey => REPO_KEYS.includes(repo);

type Outcome = 'kept' | 'dismissed';

function Proposal({ changeId, proposal }: { changeId: string; proposal: LabNoteProposal }) {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const [title, setTitle] = useState(proposal.title);
  const [body, setBody] = useState(proposal.body);
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const act = async (next: Outcome) => {
    const session = getGitHubSession();
    if (!session) {
      setFailure(t('lab.notes.signIn', { defaultValue: 'Sign in with GitHub to keep or dismiss a team note.' }));
      return;
    }
    setBusy(next);
    setFailure(null);
    const ref = { changeId, id: proposal.id };
    try {
      if (next === 'kept') {
        await createLabNote(session, {
          kind: proposal.kind,
          title: title.trim(),
          body: body.trim(),
          repos: proposal.repos.filter(isRepoKey),
          changeKinds: proposal.changeKinds,
          docsTarget: proposal.docsTarget,
          fromProposal: ref,
        });
      } else {
        await dismissLabNoteProposal(session, ref);
      }
      setOutcome(next);
    } catch (error) {
      setFailure(labRefusal(error).message);
    } finally {
      setBusy(null);
    }
  };

  if (outcome) {
    return (
      <li className="flex items-center gap-1.5 text-muted-foreground" role="status">
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {outcome === 'kept'
          ? t('lab.notes.kept', { defaultValue: 'Kept as a team note: {{title}}', title: title.trim() })
          : t('lab.notes.dismissed', { defaultValue: 'Dismissed: {{title}}', title: proposal.title })}
      </li>
    );
  }
  const canKeep = title.trim() !== '' && body.trim() !== '';
  return (
    <li className="space-y-1.5 rounded border border-border/60 p-2">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-border/60 px-1.5 text-muted-foreground">
          {t(`lab.memory.kind.${proposal.kind}`, { defaultValue: proposal.kind })}
        </span>
        {proposal.repos.map((repo) => (
          <span key={repo} className="text-muted-foreground">
            {t(`lab.repos.${repo}`, { defaultValue: repo })}
          </span>
        ))}
      </p>
      <label htmlFor={titleId} className="sr-only">
        {t('lab.notes.titleLabel', { defaultValue: 'Title' })}
      </label>
      <Input id={titleId} value={title} onChange={(event) => setTitle(event.target.value)} className="h-7 text-xs" />
      <label htmlFor={bodyId} className="sr-only">
        {t('lab.notes.bodyLabel', { defaultValue: 'Note' })}
      </label>
      <Textarea id={bodyId} value={body} onChange={(event) => setBody(event.target.value)} rows={3} className="text-xs" />
      {proposal.why ? (
        <p className="text-muted-foreground">
          {t('lab.notes.why', { defaultValue: 'Why: {{why}}', why: proposal.why })}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="break-words text-red-700 dark:text-red-400">
          {failure}
        </p>
      ) : null}
      <div className="flex justify-end gap-1.5">
        <Button type="button" size="xs" variant="ghost" onClick={() => void act('dismissed')} disabled={busy !== null}>
          {busy === 'dismissed' ? <Loader2 className="animate-spin" /> : <X />}
          {t('lab.notes.dismiss', { defaultValue: 'Dismiss' })}
        </Button>
        <Button type="button" size="xs" onClick={() => void act('kept')} disabled={busy !== null || !canKeep}>
          {busy === 'kept' ? <Loader2 className="animate-spin" /> : <BookmarkPlus />}
          {t('lab.notes.keep', { defaultValue: 'Keep as a team note' })}
        </Button>
      </div>
    </li>
  );
}

/** The proposals of change `changeId`'s build, each to keep (after an edit) or dismiss. */
export function LabNoteProposals({ changeId, proposals }: { changeId: string; proposals: LabNoteProposal[] }) {
  const { t } = useTranslation();
  const heading = t('lab.notes.proposed', { defaultValue: 'Team notes the lab agent proposes' });
  return (
    <section aria-label={heading} className="space-y-1.5 border-t border-border/60 px-3 py-2 text-[11px]">
      <p className="font-medium text-foreground">{heading}</p>
      <p className="text-muted-foreground">
        {t('lab.notes.proposedHint', {
          defaultValue: 'A kept note is read by the lab agent in later changes. Edit it first if it needs it.',
        })}
      </p>
      <ul className="space-y-1.5">
        {proposals.map((proposal) => (
          <Proposal key={proposal.id} changeId={changeId} proposal={proposal} />
        ))}
      </ul>
    </section>
  );
}
