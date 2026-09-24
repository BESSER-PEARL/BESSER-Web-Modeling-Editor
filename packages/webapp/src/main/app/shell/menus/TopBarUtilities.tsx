import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ChevronDown, GitBranch, Github, LogOut, Moon, Star, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QualityCheckResult, QualityCheckState } from '../../../features/generation/types';
import type { AgentVariantOption } from '../topbar-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  /** When provided, JS overrides the xl CSS breakpoint for text label visibility. */
  showXlLabels?: boolean;
  /** When provided, JS overrides the 2xl CSS breakpoint for text label visibility. */
  show2xlLabels?: boolean;
  onQualityCheck: () => Promise<QualityCheckResult>;
  onToggleTheme: () => void;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void;
  onOpenGitHubSidebar: () => void;
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
  showXlLabels,
  show2xlLabels,
  onQualityCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
  onToggleStar,
}) => {
  const { t } = useTranslation();

  const activeVariantLabel = !activeAgentVariantId
    ? t('topbar.baseAgentModel')
    : (agentVariantOptions?.find((o) => o.id === activeAgentVariantId)?.label ?? t('topbar.baseAgentModel'));
  // Approximate text-sm char width (~7.5px) + px-2 padding + native select arrow
  const selectWidthPx = Math.min(Math.max(100, activeVariantLabel.length * 7.5 + 48), 280);

  // Helper: when parent passes a JS-computed boolean, use it; otherwise fall back to the Tailwind class.
  const xlClass = (show: boolean | undefined, visibleClass: string, hiddenFallback: string) =>
    show !== undefined ? (show ? visibleClass : 'hidden') : hiddenFallback;


  const qualityStateLabel = qualityCheckState === 'valid'
    ? t('topbar.quality.validated')
    : qualityCheckState === 'errors'
      ? t('topbar.quality.issues')
      : qualityCheckState === 'stale'
        ? t('topbar.quality.needsRecheck')
        : qualityCheckState === 'not_validated'
          ? t('topbar.quality.notValidated')
          : null;

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
        <div className="hidden min-w-0 shrink items-center gap-1.5 xl:flex">
          <span className={xlClass(show2xlLabels, 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground', 'hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground 2xl:inline')}>
            {t('topbar.variant')}
          </span>
          <select
            className="h-9 min-w-[80px] shrink rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            style={{ width: `${selectWidthPx}px` }}
            value={activeAgentVariantId ?? ''}
            onChange={(event) => onAgentVariantChange?.(event.target.value)}
            aria-label={t('topbar.selectAgentVariant')}
            title={activeVariantLabel}
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
        <Button
          variant="outline"
          className={`gap-2 ${outlineButtonClass}`}
          onClick={() => {
            void onQualityCheck();
          }}
          title={qualityStateLabel ? `${t('topbar.quality.title')} (${qualityStateLabel})` : t('topbar.quality.title')}
        >
          <CheckCircle className="size-4" />
          <span className={xlClass(show2xlLabels, '', 'hidden 2xl:inline')}>{t('topbar.quality.title')}</span>
          {qualityStateLabel && (
            <span className={`items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium ${xlClass(showXlLabels, 'inline-flex', 'hidden xl:inline-flex')}`}>
              <span className={`size-1.5 rounded-full ${qualityStateDotClass}`} aria-hidden="true" />
              <span>{qualityStateLabel}</span>
            </span>
          )}
        </Button>
      )}

      <Button
        variant="outline"
        className={`${outlineButtonClass} px-2.5`}
        onClick={onToggleTheme}
        aria-label={isDarkTheme ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        title={isDarkTheme ? t('topbar.switchToLight') : t('topbar.switchToDark')}
      >
        {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      {isAuthenticated && !hasStarred && (
        <Button
          variant="outline"
          className={`gap-1.5 ${outlineButtonClass}`}
          onClick={onToggleStar}
          disabled={starLoading}
          title={t('topbar.starBesser')}
        >
          <Star className="size-4" />
          <span className={xlClass(show2xlLabels, '', 'hidden 2xl:inline')}>{t('topbar.star')}</span>
        </Button>
      )}

      {isAuthenticated ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`gap-1.5 ${outlineButtonClass}`}
                title={t('topbar.githubAccount', { name: username || 'GitHub' })}
              >
                <Github className="size-4" />
                <span className={`max-w-[120px] truncate ${xlClass(show2xlLabels, '', 'hidden 2xl:inline')}`}>{username || 'GitHub'}</span>
                <ChevronDown className={`size-3.5 opacity-70 ${xlClass(show2xlLabels, '', 'hidden 2xl:inline')}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[170px]">
              <DropdownMenuLabel className="truncate">{username || 'GitHub'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onGitHubLogout()} className="gap-2">
                <LogOut className="size-4" />
                {t('topbar.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className={`gap-1.5 ${outlineButtonClass}`}
            onClick={onOpenGitHubSidebar}
            title={t('topbar.githubVersionControl')}
            aria-label={t('topbar.toggleGithubPanel')}
          >
            <GitBranch className="size-4" />
            <span className={xlClass(show2xlLabels, '', 'hidden 2xl:inline')}>{t('topbar.sync')}</span>
          </Button>
        </>
      ) : (
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} onClick={onGitHubLogin} disabled={githubLoading} title={t('topbar.connectGithub')}>
          <Github className="size-4" />
          <span className={xlClass(show2xlLabels, '', 'hidden 2xl:inline')}>{githubLoading ? t('common.connecting') : 'GitHub'}</span>
        </Button>
      )}
    </>
  );
};
