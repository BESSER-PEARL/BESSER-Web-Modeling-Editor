/**
 * Browse the signed-in user's GitHub repositories, BESSER projects first.
 *
 * Selecting a repo shows what it holds (the model's name, diagrams and
 * classes, and the last commit with who made it) before the caller's action
 * runs on it: open it as a project, or link the current project to it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ExternalLink, Github, Loader2, Lock, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  BESSER_TOPIC,
  getRepoSummary,
  listBranches,
  listRepos,
  type RepoListing,
  type RepoSummary,
} from '../../api/github';
import { CommitAuthor, formatWhen } from './CommitAuthor';

export interface RepoChoice {
  owner: string;
  repo: string;
  branch: string;
  summary: RepoSummary;
}

interface RepoBrowserProps {
  githubSession: string;
  actionLabel: string;
  onAction: (choice: RepoChoice) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  /** Allow the action on a repo that holds no BESSER model yet (linking a project to an empty repo). */
  allowWithoutModel?: boolean;
  /** What a repo without a BESSER model means for this action. */
  noModelHint?: string;
  /** The action writes to the repo: repos the user may only read cannot be chosen. */
  requiresWrite?: boolean;
}

const ownerOf = (repo: RepoListing) => repo.full_name.split('/')[0];

export const RepoBrowser: React.FC<RepoBrowserProps> = ({
  githubSession,
  actionLabel,
  onAction,
  busy = false,
  error,
  allowWithoutModel = false,
  noModelHint,
  requiresWrite = false,
}) => {
  const { t, i18n } = useTranslation();
  const [repos, setRepos] = useState<RepoListing[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [showOthers, setShowOthers] = useState(false);
  const [selected, setSelected] = useState<RepoListing | null>(null);

  const load = async () => {
    setRepos(null);
    setLoadFailed(false);
    try {
      const list = await listRepos(githubSession);
      setRepos(list.repositories);
      setTruncated(list.truncated);
    } catch {
      setLoadFailed(true);
      setRepos([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubSession]);

  const { besser, others } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = (repos ?? [])
      .filter((r) => !term || r.full_name.toLowerCase().includes(term) || (r.description ?? '').toLowerCase().includes(term))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return {
      besser: matching.filter((r) => r.topics?.includes(BESSER_TOPIC)),
      others: matching.filter((r) => !r.topics?.includes(BESSER_TOPIC)),
    };
  }, [repos, search]);

  // A search should reach every repo, not only the BESSER ones.
  const othersVisible = showOthers || search.trim().length > 0 || besser.length === 0;

  const renderRow = (repo: RepoListing) => {
    const isSelected = selected?.id === repo.id;
    return (
      <li key={repo.id} className={cn('rounded-lg border transition-colors', isSelected ? 'border-brand/50 bg-brand/5' : 'border-transparent')}>
        <button
          type="button"
          onClick={() => setSelected(isSelected ? null : repo)}
          aria-expanded={isSelected}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50"
        >
          <Github className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-sm font-medium">
              {repo.full_name}
              {repo.private && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label={t('github.repoBrowser.private', { defaultValue: 'Private' })} />}
              {repo.can_push === false && (
                <Badge variant="secondary" size="sm">
                  {t('github.repoBrowser.readOnly', { defaultValue: 'Read only' })}
                </Badge>
              )}
            </span>
            {repo.description && <span className="block truncate text-xs text-muted-foreground">{repo.description}</span>}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(repo.updated_at, i18n.language)}</span>
        </button>
        {isSelected && (
          <RepoDetails
            githubSession={githubSession}
            repo={repo}
            actionLabel={actionLabel}
            onAction={onAction}
            busy={busy}
            allowWithoutModel={allowWithoutModel}
            noModelHint={noModelHint}
            readOnly={requiresWrite && repo.can_push === false}
          />
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('github.repoBrowser.search', { defaultValue: 'Search your repositories' })}
            className="pl-8"
            aria-label={t('github.repoBrowser.search', { defaultValue: 'Search your repositories' })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void load()}
          disabled={repos === null}
          aria-label={t('github.repoBrowser.refresh', { defaultValue: 'Refresh repositories' })}
        >
          <RefreshCw className={cn('size-4', repos === null && 'animate-spin')} />
        </Button>
      </div>

      {repos === null ? (
        <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('github.repoBrowser.loading', { defaultValue: 'Loading your repositories…' })}
        </div>
      ) : loadFailed ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t('github.repoBrowser.loadFailed', { defaultValue: 'Could not load your repositories. Check your GitHub connection and try again.' })}
        </p>
      ) : (
        <div className="max-h-[min(26rem,55vh)] overflow-y-auto overscroll-contain pr-1">
          <section aria-labelledby="repo-browser-besser">
            <h4 id="repo-browser-besser" className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('github.repoBrowser.besserRepos', { defaultValue: 'BESSER projects' })}
            </h4>
            {besser.length > 0 ? (
              <ul className="flex flex-col gap-1">{besser.map(renderRow)}</ul>
            ) : (
              <p className="px-1 pb-2 text-xs text-muted-foreground">
                {search.trim()
                  ? t('github.repoBrowser.noBesserMatch', { defaultValue: 'No BESSER project matches your search.' })
                  : t('github.repoBrowser.noBesserRepos', {
                      defaultValue: 'None yet. Repositories you push from BESSER show up here.',
                    })}
              </p>
            )}
          </section>

          {others.length > 0 && (
            <section aria-labelledby="repo-browser-others" className="mt-3">
              {othersVisible ? (
                <>
                  <h4 id="repo-browser-others" className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t('github.repoBrowser.otherRepos', { defaultValue: 'Other repositories' })}
                  </h4>
                  <ul className="flex flex-col gap-1">{others.map(renderRow)}</ul>
                </>
              ) : (
                <button
                  type="button"
                  id="repo-browser-others"
                  onClick={() => setShowOthers(true)}
                  className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="size-3.5" />
                  {t('github.repoBrowser.showOthers', { defaultValue: 'Show {{count}} other repositories', count: others.length })}
                </button>
              )}
            </section>
          )}
        </div>
      )}

      {truncated && (
        <p className="px-1 text-xs text-muted-foreground">
          {t('github.repoBrowser.truncated', {
            defaultValue: 'Showing your {{count}} most recently updated repositories. Paste a link to open another one.',
            count: repos?.length ?? 0,
          })}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

interface RepoDetailsProps {
  githubSession: string;
  repo: RepoListing;
  actionLabel: string;
  onAction: (choice: RepoChoice) => void | Promise<void>;
  busy: boolean;
  allowWithoutModel: boolean;
  noModelHint?: string;
  /** The user may not write to this repo, and the action needs to. */
  readOnly: boolean;
}

const RepoDetails: React.FC<RepoDetailsProps> = ({
  githubSession, repo, actionLabel, onAction, busy, allowWithoutModel, noModelHint, readOnly,
}) => {
  const { t } = useTranslation();
  const owner = ownerOf(repo);
  const [branches, setBranches] = useState<string[]>([repo.default_branch]);
  const [branch, setBranch] = useState(repo.default_branch);
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBranches(githubSession, owner, repo.name)
      .then((list) => !cancelled && list.length > 0 && setBranches(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [githubSession, owner, repo.name]);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setSummaryFailed(false);
    getRepoSummary(githubSession, owner, repo.name, branch)
      .then((result) => !cancelled && setSummary(result))
      .catch(() => !cancelled && setSummaryFailed(true));
    return () => {
      cancelled = true;
    };
  }, [githubSession, owner, repo.name, branch]);

  const diagramChips = summary
    ? Object.entries(summary.diagram_counts).map(([kind, count]) => (
        <Badge key={kind} variant="secondary" size="sm">
          {t(`github.repoBrowser.diagramKinds.${kind}`, { defaultValue: kind })}
          {count > 1 ? ` ×${count}` : ''}
        </Badge>
      ))
    : null;
  const canAct = !!summary && (summary.has_model || allowWithoutModel) && !readOnly;

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 px-3 pb-3 pt-3">
      {summary === null && !summaryFailed ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" />
          {t('github.repoBrowser.reading', { defaultValue: 'Reading the repository…' })}
        </div>
      ) : summaryFailed ? (
        <p className="text-xs text-destructive">
          {t('github.repoBrowser.summaryFailed', { defaultValue: 'Could not read this repository.' })}
        </p>
      ) : summary && summary.has_model ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold">{summary.project_name || repo.name}</p>
          <div className="flex flex-wrap gap-1">{diagramChips}</div>
          {summary.class_count > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('github.repoBrowser.classes', { defaultValue: '{{count}} classes', count: summary.class_count })}
              {': '}
              {summary.class_names.join(', ')}
              {summary.class_count > summary.class_names.length ? ', …' : ''}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {noModelHint ?? t('github.repoBrowser.noModel', { defaultValue: 'No BESSER model in this repository yet.' })}
        </p>
      )}

      {readOnly && (
        <p className="text-xs text-muted-foreground">
          {t('github.repoBrowser.readOnlyHint', {
            defaultValue: 'Your GitHub account can read this repository but not write to it, so BESSER cannot save to it.',
          })}
        </p>
      )}

      {summary?.last_commit && (
        <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs">
          <p className="line-clamp-1 font-medium">{summary.last_commit.message.split('\n')[0]}</p>
          <CommitAuthor commit={summary.last_commit} />
        </div>
      )}

      <div className="flex items-center gap-2">
        {branches.length > 1 && (
          <Select value={branch} onValueChange={setBranch} disabled={busy}>
            <SelectTrigger className="h-9 w-36" aria-label={t('github.linkModal.branch')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type="button"
          className="flex-1 gap-2"
          disabled={!canAct || busy}
          onClick={() => summary && void onAction({ owner, repo: repo.name, branch, summary })}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
          {actionLabel}
        </Button>
        <Button type="button" variant="outline" size="icon" asChild>
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('github.linked.openOnGitHub')}
            title={t('github.linked.openOnGitHub')}
          >
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
};
