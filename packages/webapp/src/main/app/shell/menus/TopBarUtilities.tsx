import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ChevronDown, Moon, Star, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputBaseClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { QualityCheckResult, QualityCheckState } from '../../../features/generation/types';
import { GitHubMenu } from '../../../features/github/components/GitHubMenu';
import type { AgentVariantOption } from '../topbar-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderTooltip } from './HeaderTooltip';

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
  /** When set, the quality check button opens a menu with the syntactic and semantic checks. */
  onSemanticCheck?: () => Promise<void>;
  onToggleTheme: () => void;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void;
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
  onSemanticCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onToggleStar,
}) => {
  const { t } = useTranslation();
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

  const qualityStateDotClass = qualityCheckState === 'valid'
    ? 'bg-emerald-500'
    : qualityCheckState === 'errors'
      ? 'bg-red-500'
      : qualityCheckState === 'stale'
        ? 'bg-amber-500'
        : 'bg-slate-400';

  const qualityButtonContent = (
    <>
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
    </>
  );

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

      {showQualityCheck && !onSemanticCheck && (
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
            {qualityButtonContent}
          </Button>
        </HeaderTooltip>
      )}

      {showQualityCheck && onSemanticCheck && (
        <DropdownMenu>
          <HeaderTooltip label={qualityLabel} hideFrom="2xl">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={`gap-2 ${outlineButtonClass}`} aria-label={qualityLabel}>
                {qualityButtonContent}
                <ChevronDown className="hidden size-3 opacity-50 2xl:block" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </HeaderTooltip>
          <DropdownMenuContent align="end" className="min-w-[170px]">
            <DropdownMenuItem onSelect={() => void onQualityCheck()}>
              {t('topbar.quality.syntacticCheck')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onSemanticCheck()}>
              {t('topbar.quality.semanticCheck')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      <GitHubMenu
        outlineButtonClass={outlineButtonClass}
        isAuthenticated={isAuthenticated}
        username={username}
        githubLoading={githubLoading}
        onLogin={onGitHubLogin}
        onLogout={onGitHubLogout}
      />
    </>
  );
};
