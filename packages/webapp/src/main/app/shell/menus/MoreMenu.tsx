import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Github,
  Info,
  Keyboard,
  Languages,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Rocket,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageRadioItems } from '../LanguageSelector';
import { HeaderTooltip } from './HeaderTooltip';

interface MoreMenuProps {
  outlineButtonClass: string;
  isDarkTheme: boolean;
  isAuthenticated: boolean;
  githubLoading: boolean;
  isDeploymentAvailable: boolean;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void;
  onOpenDeployDialog: () => void;
  onOpenHelpDialog: () => void;
  onOpenAboutDialog: () => void;
  onOpenKeyboardShortcuts: () => void;
  onOpenFeedback: () => void;
  onToggleTheme: () => void;
}

/** Below `sm`, Deploy, Help, Language, Theme and sign-out fold into this one menu. */
export const MoreMenu: React.FC<MoreMenuProps> = ({
  outlineButtonClass,
  isDarkTheme,
  isAuthenticated,
  githubLoading,
  isDeploymentAvailable,
  onGitHubLogin,
  onGitHubLogout,
  onOpenDeployDialog,
  onOpenHelpDialog,
  onOpenAboutDialog,
  onOpenKeyboardShortcuts,
  onOpenFeedback,
  onToggleTheme,
}) => {
  const { t } = useTranslation();
  const label = t('topbar.more', { defaultValue: 'More' });
  const publishEnabled = isDeploymentAvailable && isAuthenticated;

  return (
    <DropdownMenu>
      <HeaderTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`sm:hidden ${outlineButtonClass}`} aria-label={label}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </HeaderTooltip>
      <DropdownMenuContent className="w-64" align="end">
        {!isAuthenticated && (
          <DropdownMenuItem onClick={onGitHubLogin} disabled={githubLoading}>
            <Github className="mr-2 size-4" />
            {githubLoading ? t('common.connecting') : t('menu.deploy.connectGitHub')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={publishEnabled ? onOpenDeployDialog : undefined} disabled={!publishEnabled}>
          <Rocket className="mr-2 size-4" />
          {t('menu.deploy.publishToRender')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenHelpDialog}>
          <BookOpen className="mr-2 size-4" />
          {t('menu.help.howItWorks')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenKeyboardShortcuts}>
          <Keyboard className="mr-2 size-4" />
          {t('menu.help.keyboardShortcuts')}
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenFeedback}>
          <MessageSquare className="mr-2 size-4" />
          {t('menu.community.sendFeedback')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAboutDialog}>
          <Info className="mr-2 size-4" />
          {t('menu.help.aboutBesser')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="mr-2 size-4" />
            {t('topbar.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[180px]">
            <LanguageRadioItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onToggleTheme}>
          {isDarkTheme ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
          {isDarkTheme ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        </DropdownMenuItem>
        {isAuthenticated && (
          <DropdownMenuItem onSelect={() => onGitHubLogout()}>
            <LogOut className="mr-2 size-4" />
            {t('topbar.signOut')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
