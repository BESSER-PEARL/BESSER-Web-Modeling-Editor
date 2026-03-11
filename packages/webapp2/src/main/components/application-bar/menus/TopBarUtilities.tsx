import React from 'react';
import { ChevronDown, Github, LogOut, Moon, Star, Sun } from 'lucide-react';
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
        <Button variant="outline" className={outlineButtonClass} onClick={onQualityCheck}>
          Quality Check
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
          className={`gap-1.5 ${outlineButtonClass} ${hasStarred ? 'text-yellow-500 hover:text-yellow-600' : ''}`}
          onClick={onToggleStar}
          disabled={starLoading}
          title={hasStarred ? 'Unstar BESSER on GitHub' : 'Star BESSER on GitHub'}
        >
          <Star className={`h-4 w-4 ${hasStarred ? 'fill-current' : ''}`} />
          {hasStarred ? 'Starred' : 'Star'}
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
                <span className="max-w-[120px] truncate">{username || 'GitHub'}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
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
            className={`${outlineButtonClass} px-2.5`}
            onClick={onOpenGitHubSidebar}
            title="GitHub Version Control"
            aria-label="Toggle GitHub version control panel"
          >
            <Github className="h-4 w-4" />
            <span className="sr-only">GitHub Sync</span>
          </Button>
        </>
      ) : (
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} onClick={onGitHubLogin} disabled={githubLoading}>
          <Github className="h-4 w-4" />
          {githubLoading ? 'Connecting...' : 'Connect GitHub'}
        </Button>
      )}
    </>
  );
};
