import React from 'react';
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
  onQualityCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
  onToggleStar,
}) => {
  const qualityStateLabel = qualityCheckState === 'valid'
    ? 'Validated'
    : qualityCheckState === 'errors'
      ? 'Issues'
      : qualityCheckState === 'stale'
        ? 'Needs recheck'
        : qualityCheckState === 'not_validated'
          ? 'Not validated'
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
        <div className="hidden min-w-0 shrink items-center gap-1.5 xl:flex 2xl:gap-2">
          <span className="hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground 2xl:inline">Variant</span>
          <select
            className="h-9 w-[140px] min-w-0 shrink rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 2xl:w-[210px] 2xl:px-3"
            value={activeAgentVariantId ?? ''}
            onChange={(event) => onAgentVariantChange?.(event.target.value)}
            aria-label="Select agent model variant"
            title="Select agent model variant"
          >
            <option value="">Base agent model</option>
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
          title={qualityStateLabel ? `Quality Check (${qualityStateLabel})` : 'Quality Check'}
        >
          <CheckCircle className="size-4" />
          <span className="hidden xl:inline">Quality Check</span>
          {qualityStateLabel && (
            <span className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium xl:inline-flex">
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
        aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      {isAuthenticated && !hasStarred && (
        <Button
          variant="outline"
          className={`gap-1.5 ${outlineButtonClass}`}
          onClick={onToggleStar}
          disabled={starLoading}
          title="Star BESSER on GitHub"
        >
          <Star className="size-4" />
          <span className="hidden xl:inline">Star</span>
        </Button>
      )}

      {isAuthenticated ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`gap-1.5 ${outlineButtonClass}`}
                title={`GitHub account: ${username || 'GitHub'}`}
              >
                <Github className="size-4" />
                <span className="hidden max-w-[120px] truncate xl:inline">{username || 'GitHub'}</span>
                <ChevronDown className="hidden size-3.5 opacity-70 xl:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[170px]">
              <DropdownMenuLabel className="truncate">{username || 'GitHub'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onGitHubLogout()} className="gap-2">
                <LogOut className="size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className={`gap-1.5 ${outlineButtonClass}`}
            onClick={onOpenGitHubSidebar}
            title="GitHub Version Control"
            aria-label="Toggle GitHub version control panel"
          >
            <GitBranch className="size-4" />
            <span className="hidden xl:inline">Sync</span>
          </Button>
        </>
      ) : (
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} onClick={onGitHubLogin} disabled={githubLoading} title="Connect GitHub">
          <Github className="size-4" />
          <span className="hidden xl:inline">{githubLoading ? 'Connecting...' : 'GitHub'}</span>
        </Button>
      )}
    </>
  );
};
