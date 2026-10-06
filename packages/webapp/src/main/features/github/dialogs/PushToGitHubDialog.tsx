/**
 * PushToGitHubDialog — pushes a finished Spec-Driven Agent run (generated
 * code + project model) to a GitHub repo.
 *
 * Modes:
 *   - UPDATE   — a ``'github'`` link already exists for this project. Shows the
 *                linked ``owner/repo@branch`` banner + commit message, with
 *                "Change repo" to unlink and fall back to CREATE/SELECT.
 *   - CREATE   — create a brand-new repo (name / description / private default).
 *   - EXISTING — pick one of the user's repos + a branch and push into it.
 *
 * State (open/link/result/push) is owned by ``useSpecDrivenGithubPush``; this
 * component owns only its form fields and the repo/branch picker.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Github, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { validateRepoName } from '../../../shared/utils/validation';
import { useFieldValidation } from '../../../shared/hooks/useFieldValidation';
import type { DeployLinkedRepo } from '../../../shared/services/storage/local-storage-repository';
import { useGitHubStorage } from '../hooks/useGitHubStorage';
import type {
  SpecDrivenPushConfig,
  SpecDrivenPushResult,
  SpecDrivenPushOutcome,
} from '../hooks/useSpecDrivenGithubPush';

const DEFAULT_BRANCH = 'main';

/** Mirror DeployMenu's repo-name sanitizer for the create-new default. */
const sanitizeRepoName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const defaultRepoName = (projectName: string): string =>
  sanitizeRepoName(projectName) || 'besser-app';

export interface PushToGitHubDialogProps {
  open: boolean;
  runId: string | null;
  projectName: string;
  linkedRepo: DeployLinkedRepo | null;
  githubSession: string | null;
  isPushing: boolean;
  result: SpecDrivenPushResult | null;
  onOpenChange: (open: boolean) => void;
  onChangeRepo: () => void;
  push: (config: SpecDrivenPushConfig) => Promise<SpecDrivenPushOutcome>;
}

export const PushToGitHubDialog: React.FC<PushToGitHubDialogProps> = ({
  open,
  projectName,
  linkedRepo,
  githubSession,
  isPushing,
  result,
  onOpenChange,
  onChangeRepo,
  push,
}) => {
  const { t } = useTranslation();
  const { repositories, isLoading: reposLoading, fetchRepositories, fetchBranches } = useGitHubStorage();

  const isUpdateMode = !!linkedRepo && !result;

  // ── Form state ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [createBranch, setCreateBranch] = useState(DEFAULT_BRANCH);
  const [commitMessage, setCommitMessage] = useState('');

  // Existing-repo picker
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [inlineError, setInlineError] = useState<string | null>(null);
  // Auto-load once per open; an empty or failed list is retried explicitly.
  const [reposRequested, setReposRequested] = useState(false);

  // ── Inline validation (create-new mode only) ───────────────────────────
  const validators = useMemo(
    () => ({
      repoName: () => (mode === 'create' && !isUpdateMode ? validateRepoName(repoName) : undefined),
    }),
    [mode, isUpdateMode, repoName],
  );
  const validation = useFieldValidation(validators);

  // Initialize the form on the rising edge of ``open`` so re-renders while the
  // dialog is up don't wipe what the user is typing.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setMode('create');
      setRepoName(defaultRepoName(projectName));
      setDescription(t('github.push.defaultDescription', { name: projectName || 'project' }));
      setIsPrivate(true);
      setCreateBranch(DEFAULT_BRANCH);
      setCommitMessage('');
      setSelectedRepoFullName('');
      setBranches([]);
      setSelectedBranch('');
      setInlineError(null);
      setReposRequested(false);
      validation.resetTouched();
    }
    wasOpenRef.current = open;
  }, [open, projectName, validation, t]);

  // Lazy-load repositories when the user first switches to "Use existing".
  useEffect(() => {
    if (!open || mode !== 'existing' || !githubSession) return;
    if (repositories.length > 0 || reposLoading || reposRequested) return;
    setReposRequested(true);
    void fetchRepositories(githubSession);
  }, [open, mode, githubSession, repositories.length, reposLoading, reposRequested, fetchRepositories]);

  // Only the latest repo selection may apply its branch list; an earlier,
  // slower response would otherwise overwrite the current repo's branches.
  const branchRequestRef = useRef(0);
  const handleSelectRepo = async (fullName: string) => {
    const requestId = ++branchRequestRef.current;
    setSelectedRepoFullName(fullName);
    setBranches([]);
    setSelectedBranch('');
    setInlineError(null);
    const repo = repositories.find((r) => r.full_name === fullName);
    if (!repo || !githubSession) return;
    setLoadingBranches(true);
    const [owner] = repo.full_name.split('/');
    const list = await fetchBranches(githubSession, owner, repo.name);
    if (requestId !== branchRequestRef.current) return;
    setLoadingBranches(false);
    const resolved = list.length > 0 ? list : [repo.default_branch].filter(Boolean);
    setBranches(resolved);
    setSelectedBranch(repo.default_branch || resolved[0] || DEFAULT_BRANCH);
  };

  const handlePush = async () => {
    setInlineError(null);
    let config: SpecDrivenPushConfig;

    if (isUpdateMode && linkedRepo) {
      config = {
        useExisting: true,
        repoName: linkedRepo.repo,
        isPrivate,
        branch: linkedRepo.branch || DEFAULT_BRANCH,
        commitMessage: commitMessage.trim() || undefined,
      };
    } else if (mode === 'existing') {
      const repo = repositories.find((r) => r.full_name === selectedRepoFullName);
      if (!repo) {
        setInlineError(t('github.push.selectRepositoryError'));
        return;
      }
      config = {
        useExisting: true,
        repoName: repo.name,
        isPrivate: repo.private,
        branch: selectedBranch || repo.default_branch || DEFAULT_BRANCH,
        commitMessage: commitMessage.trim() || undefined,
      };
    } else {
      if (validateRepoName(repoName)) {
        validation.markTouched('repoName');
        return;
      }
      config = {
        useExisting: false,
        repoName: repoName.trim(),
        description: description.trim() || undefined,
        isPrivate,
        branch: createBranch.trim() || DEFAULT_BRANCH,
        commitMessage: commitMessage.trim() || undefined,
      };
    }

    const outcome = await push(config);
    if (!outcome.ok) {
      setInlineError(outcome.message);
      // A name clash → the repo already exists; drop the user into the picker
      // so they can push to it as an existing repo instead.
      if (outcome.code === 'conflict') {
        setMode('existing');
      }
    }
    // On success the hook updates ``result`` and this renders the success view.
  };

  const canSubmit =
    !isPushing &&
    (isUpdateMode
      ? true
      : mode === 'existing'
        ? !!selectedRepoFullName
        : validation.isValid);

  // ── Success view ───────────────────────────────────────────────────────
  if (result?.success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="size-5" />
              {t('github.push.successTitle')}
            </DialogTitle>
            <DialogDescription>
              {result.is_first_push ? t('github.push.successCreated') : t('github.push.successUpdated')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <p className="font-medium">
                {result.owner}/{result.repo_name}
              </p>
              <p className="text-xs">{t('github.push.filesUploaded', { count: result.files_uploaded })}</p>
            </div>
            <a
              href={result.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline"
            >
              <ExternalLink className="size-4" />
              {t('github.linked.openOnGitHub')}
            </a>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{t('github.push.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Push form ──────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="size-5" />
            {t('github.commit.title')}
          </DialogTitle>
          <DialogDescription>
            {isUpdateMode
              ? t('github.push.descriptionUpdate')
              : t('github.push.descriptionCreate')}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) void handlePush();
          }}
        >
        <div className="flex flex-col gap-4">
          {isUpdateMode && linkedRepo ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={`${linkedRepo.owner}/${linkedRepo.repo}@${linkedRepo.branch || DEFAULT_BRANCH}`}>
                    {t('github.push.linkedTo')}{' '}
                    <a
                      href={`https://github.com/${linkedRepo.owner}/${linkedRepo.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {linkedRepo.owner}/{linkedRepo.repo}
                    </a>
                    <span className="text-xs opacity-80">@{linkedRepo.branch || DEFAULT_BRANCH}</span>
                  </p>
                  <p className="text-xs">{t('github.push.repushHint')}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onChangeRepo} disabled={isPushing}>
                  {t('github.push.changeRepo')}
                </Button>
              </div>
              <FormField label={t('github.commit.messageLabel')} htmlFor="push-update-commit-message" helperText={t('github.push.commitMessageHelper')}>
                <Input
                  id="push-update-commit-message"
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                  placeholder={t('github.push.commitMessagePlaceholder')}
                />
              </FormField>
            </>
          ) : (
            <>
              {/* Create vs. existing toggle */}
              <div className="inline-flex w-full rounded-md border border-border/70 p-0.5 text-sm">
                <button
                  type="button"
                  aria-pressed={mode === 'create'}
                  onClick={() => setMode('create')}
                  className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
                    mode === 'create' ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('github.push.createNew')}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'existing'}
                  onClick={() => setMode('existing')}
                  className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
                    mode === 'existing' ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('github.push.useExisting')}
                </button>
              </div>

              {mode === 'create' ? (
                <>
                  <FormField label={t('github.createRepo.repoNameLabel')} htmlFor="push-create-repo-name" required error={validation.getError('repoName')}>
                    <Input
                      id="push-create-repo-name"
                      name="repo-name"
                      autoComplete="off"
                      spellCheck={false}
                      value={repoName}
                      onChange={(event) => setRepoName(event.target.value)}
                      onBlur={() => validation.markTouched('repoName')}
                      placeholder="my-generated-app"
                      className={validation.getError('repoName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                    />
                  </FormField>
                  <FormField label={t('github.createRepo.descriptionLabel')} htmlFor="push-create-description">
                    <Textarea
                      id="push-create-description"
                      rows={2}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder={t('github.createRepo.descriptionPlaceholder')}
                    />
                  </FormField>
                  <div className="flex items-center gap-2">
                    <Checkbox id="push-create-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
                    <Label htmlFor="push-create-private" className="font-normal">
                      {t('github.createRepo.privateRepository')}
                    </Label>
                  </div>
                  {!isPrivate && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {t('github.push.publicWarning')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <FormField label={t('github.linked.repository')} htmlFor="push-existing-repo">
                    <Select
                      value={selectedRepoFullName}
                      // Radix's hidden form <select> can echo '' while options mount; ignore it.
                      onValueChange={(value) => value && void handleSelectRepo(value)}
                      disabled={reposLoading}
                    >
                      <SelectTrigger id="push-existing-repo">
                        <SelectValue
                          placeholder={reposLoading ? t('github.push.loadingRepositories') : t('github.push.selectRepository')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo) => (
                          <SelectItem key={repo.id} value={repo.full_name}>
                            {repo.private ? t('github.push.privateRepoOption', { name: repo.full_name }) : repo.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  {!reposLoading && reposRequested && repositories.length === 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <span>{t('github.push.noRepositories')}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          if (githubSession) void fetchRepositories(githubSession);
                        }}
                      >
                        {t('common.retry')}
                      </Button>
                    </div>
                  )}
                  {selectedRepoFullName && (
                    <FormField label={t('github.linkModal.branch')} htmlFor="push-existing-branch">
                      <Select value={selectedBranch} onValueChange={(value) => value && setSelectedBranch(value)} disabled={loadingBranches}>
                        <SelectTrigger id="push-existing-branch">
                          <SelectValue placeholder={loadingBranches ? t('github.push.loadingBranches') : undefined} />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch} value={branch}>
                              {branch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                  <FormField label={t('github.commit.messageLabel')} htmlFor="push-existing-commit-message" helperText={t('github.push.commitMessageHelper')}>
                    <Input
                      id="push-existing-commit-message"
                      value={commitMessage}
                      onChange={(event) => setCommitMessage(event.target.value)}
                      placeholder={t('github.push.commitMessagePlaceholder')}
                    />
                  </FormField>
                </>
              )}
            </>
          )}

          {inlineError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {inlineError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPushing}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!canSubmit} className="gap-1.5">
            {isPushing ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
            {isPushing ? t('github.commit.pushing') : isUpdateMode ? t('github.push.pushUpdate') : t('github.commit.title')}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
