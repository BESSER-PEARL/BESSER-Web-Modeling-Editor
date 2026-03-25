import React from 'react';
import { CheckCircle, ChevronDown, GitBranch, Github, LogOut, Moon, Star, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onQualityCheck: () => void;
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
  onQualityCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
  onToggleStar,
}) => {
  return (
    <>
      {showQualityCheck && (
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} onClick={onQualityCheck} title="Quality Check">
          <CheckCircle className="h-4 w-4" />
          <span className="hidden xl:inline">Quality Check</span>
        </Button>
      )}

      <Button
        variant="outline"
        className={`${outlineButtonClass} px-2.5`}
        onClick={onToggleTheme}
        aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {isAuthenticated && (
        <Button
          variant="outline"
          className={`gap-1.5 ${outlineButtonClass} ${hasStarred ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300' : ''}`}
          onClick={onToggleStar}
          disabled={starLoading}
          title={hasStarred ? 'Unstar BESSER on GitHub' : 'Star BESSER on GitHub'}
        >
          <Star className={`h-4 w-4 ${hasStarred ? 'fill-current' : ''}`} />
          <span className="hidden xl:inline">{hasStarred ? 'Starred' : 'Star'}</span>
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
                <Github className="h-4 w-4" />
                <span className="hidden max-w-[120px] truncate xl:inline">{username || 'GitHub'}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 opacity-70 xl:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[170px]">
              <DropdownMenuLabel className="truncate">{username || 'GitHub'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onGitHubLogout()} className="gap-2">
                <LogOut className="h-4 w-4" />
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
            <GitBranch className="h-4 w-4" />
            <span className="hidden xl:inline">Sync</span>
          </Button>
        </>
      ) : (
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} onClick={onGitHubLogin} disabled={githubLoading} title="Connect GitHub">
          <Github className="h-4 w-4" />
          <span className="hidden xl:inline">{githubLoading ? 'Connecting...' : 'GitHub'}</span>
        </Button>
      )}
    </>
  );
};
