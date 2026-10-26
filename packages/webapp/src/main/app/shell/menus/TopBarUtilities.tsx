import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ChevronDown, GitBranch, Github, LogOut, Moon, Star, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputBaseClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { QualityCheckResult, QualityCheckState } from '../../../features/generation/types';
import type { AgentVariantOption, RepoStatusSummary } from '../topbar-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderTooltip } from './HeaderTooltip';

// Dot on the GitHub button; no dot while unlinked or signed out.
const REPO_STATE_TONE: Record<RepoStatusSummary['state'], string | undefined> = {
  'in-sync': 'bg-success',
  'local-changes': 'bg-warning',
  behind: 'bg-warning',
  diverged: 'bg-warning',
  checking: 'bg-muted-foreground/50',
  unknown: 'bg-muted-foreground/50',
  unlinked: undefined,
  'signed-out': undefined,
};

const REPO_STATE_LABEL: Record<RepoStatusSummary['state'], string> = {
  'in-sync': '{{repo}}: in sync with GitHub',
  'local-changes': '{{repo}}: model changes not saved to GitHub',
  behind: '{{repo}}: {{count}} new commits on GitHub',
  diverged: '{{repo}}: changed here and on GitHub',
  checking: '{{repo}}: checking GitHub',
  unknown: '{{repo}}: could not reach GitHub',
  unlinked: 'Link this project to a GitHub repository',
  'signed-out': 'GitHub',
};

interface TopBarUtilitiesProps {
  showQualityCheck: boolean;
  outlineButtonClass: string;
  isDarkTheme: boolean;
  isAuthenticated: boolean;
  username?: string;
  githubLoading: boolean;
  hasStarred: boolean;
  starLoading: boolean;
  qualityCheckState?: QualityCheckState;
  showAgentVariantSelector?: boolean;
  agentVariantOptions?: AgentVariantOption[];
  activeAgentVariantId?: string;
  onAgentVariantChange?: (variantId: string) => void;
  onQualityCheck: () => Promise<QualityCheckResult>;
  onToggleTheme: () => void;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void;
  onOpenGitHubSidebar: () => void;
  repoStatus?: RepoStatusSummary;
  onToggleStar: () => void;
}

export const TopBarUtilities: React.FC<TopBarUtilitiesProps> = ({
  showQualityCheck,
  outlineButtonClass,
  isDarkTheme,
  isAuthenticated,
  username,
  githubLoading,
  hasStarred,
  starLoading,
  qualityCheckState,
  showAgentVariantSelector,
  agentVariantOptions,
  activeAgentVariantId,
  onAgentVariantChange,
  onQualityCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
  repoStatus,
  onToggleStar,
}) => {
  const { t } = useTranslation();
  const repoTone = repoStatus ? REPO_STATE_TONE[repoStatus.state] : undefined;
  // No linked repo: say what the button does instead of showing a bare icon.
  const isUnlinked = repoStatus?.state === 'unlinked';
  const repoLabel = repoStatus
    ? t(`topbar.repoState.${repoStatus.state}`, {
        defaultValue: REPO_STATE_LABEL[repoStatus.state],
        repo: repoStatus.repo,
        count: repoStatus.behind,
      })
    : t('topbar.githubVersionControl');
  const qualityStateLabel = qualityCheckState === 'valid'
    ? t('topbar.quality.validated')
    : qualityCheckState === 'errors'
      ? t('topbar.quality.issues')
      : qualityCheckState === 'stale'
        ? t('topbar.quality.needsRecheck')
        : qualityCheckState === 'not_validated'
          ? t('topbar.quality.notValidated')
          : null;

  const qualityLabel = qualityStateLabel
    ? `${t('topbar.quality.title')}: ${qualityStateLabel}`
    : t('topbar.quality.title');
  const themeLabel = isDarkTheme ? t('topbar.switchToLight') : t('topbar.switchToDark');
  const accountLabel = t('topbar.githubAccount', { name: username || 'GitHub' });

  const qualityStateDotClass = qualityCheckState === 'valid'
    ? 'bg-emerald-500'
    : qualityCheckState === 'errors'
      ? 'bg-red-500'
      : qualityCheckState === 'stale'
        ? 'bg-amber-500'
        : 'bg-slate-400';

  return (
    <>
      {showAgentVariantSelector && (
        <div className="hidden min-w-0 shrink items-center gap-1.5 xl:flex 2xl:gap-2">
          <span className="ui-kicker hidden 2xl:inline">{t('topbar.variant')}</span>
          <select
            className={cn(inputBaseClass, 'h-9 w-[180px] min-w-0 shrink px-2 py-1 2xl:w-[210px] 2xl:px-3')}
            value={activeAgentVariantId ?? ''}
            onChange={(event) => onAgentVariantChange?.(event.target.value)}
            aria-label={t('topbar.selectAgentVariant')}
            title={t('topbar.selectAgentVariant')}
          >
            <option value="">{t('topbar.baseAgentModel')}</option>
            {(agentVariantOptions ?? []).map((option) => (
              <option key={option.id} value={option.id} title={option.description}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showQualityCheck && (
        <HeaderTooltip label={qualityLabel} hideFrom="2xl">
          <Button
            variant="ghost"
            size="sm"
            className={`gap-2 ${outlineButtonClass}`}
            onClick={() => {
              void onQualityCheck();
            }}
            aria-label={qualityLabel}
          >
            <CheckCircle className="size-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">{t('topbar.quality.title')}</span>
            {qualityStateLabel && (
              <span
                aria-hidden="true"
                className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium xl:inline-flex"
              >
                <span className={`size-1.5 rounded-full ${qualityStateDotClass}`} />
                <span>{qualityStateLabel}</span>
              </span>
            )}
          </Button>
        </HeaderTooltip>
      )}

      <HeaderTooltip label={themeLabel}>
        <Button
          variant="ghost"
          size="sm"
          className={`hidden sm:inline-flex ${outlineButtonClass} px-2.5`}
          onClick={onToggleTheme}
          aria-label={themeLabel}
        >
          {isDarkTheme ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
        </Button>
      </HeaderTooltip>

      {isAuthenticated && !hasStarred && (
        <HeaderTooltip label={t('topbar.starBesser')}>
          <Button
            variant="ghost"
            size="sm"
            className={`hidden gap-1.5 sm:inline-flex ${outlineButtonClass}`}
            onClick={onToggleStar}
            disabled={starLoading}
            aria-label={t('topbar.starBesser')}
          >
            <Star className="size-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">{t('topbar.star')}</span>
          </Button>
        </HeaderTooltip>
      )}

      {isAuthenticated ? (
        <>
          <DropdownMenu>
            <HeaderTooltip label={accountLabel} hideFrom="2xl">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hidden gap-1.5 sm:inline-flex ${outlineButtonClass}`}
                  aria-label={accountLabel}
                >
                  <Github className="size-4" aria-hidden="true" />
                  <span className="hidden max-w-[120px] truncate 2xl:inline">{username || 'GitHub'}</span>
                  <ChevronDown className="hidden size-3 opacity-50 2xl:block" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </HeaderTooltip>
            <DropdownMenuContent align="end" className="min-w-[170px]">
              <DropdownMenuLabel className="truncate">{username || 'GitHub'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onGitHubLogout()}>
                <LogOut className="mr-2 size-4" />
                {t('topbar.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <HeaderTooltip label={repoLabel}>
            <Button
              variant="ghost"
              size="sm"
              className={`relative gap-1.5 ${outlineButtonClass}`}
              onClick={onOpenGitHubSidebar}
              aria-label={`${t('topbar.toggleGithubPanel')}: ${repoLabel}`}
            >
              <GitBranch className="size-4" aria-hidden="true" />
              {isUnlinked ? (
                <span className="hidden lg:inline">{t('topbar.linkToGithub', { defaultValue: 'Link to GitHub' })}</span>
              ) : (
                <span className="hidden max-w-[11rem] truncate 2xl:inline">{repoStatus?.repo || t('topbar.sync')}</span>
              )}
              {repoTone && (
                <span
                  aria-hidden="true"
                  className={cn('absolute right-1 top-1 size-2 rounded-full ring-2 ring-background', repoTone)}
                />
              )}
            </Button>
          </HeaderTooltip>
        </>
      ) : (
        <HeaderTooltip label={t('topbar.connectGithub')} hideFrom="2xl">
          <Button
            variant="ghost"
            size="sm"
            className={`gap-2 ${outlineButtonClass}`}
            onClick={onGitHubLogin}
            disabled={githubLoading}
            aria-label={t('topbar.connectGithub')}
          >
            <Github className="size-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">{githubLoading ? t('common.connecting') : 'GitHub'}</span>
          </Button>
        </HeaderTooltip>
      )}
    </>
  );
};
