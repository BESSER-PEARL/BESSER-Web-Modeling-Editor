import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Bug,
  ChevronDown,
  ExternalLink,
  FolderGit2,
  GitPullRequest,
  HelpCircle,
  Info,
  Keyboard,
  MessageSquare,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bugReportURL } from '../../../shared/constants/constant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const COMMUNITY_URLS = {
  contribute: 'https://github.com/BESSER-PEARL/BESSER/blob/master/CONTRIBUTING.md',
  repository: 'https://github.com/BESSER-PEARL/BESSER',
};

const ExternalLinkItem: React.FC<{ href: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  href,
  icon,
  children,
}) => (
  <DropdownMenuItem asChild>
    <a href={href} target="_blank" rel="noopener noreferrer">
      {icon}
      {children}
      <ExternalLink className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
    </a>
  </DropdownMenuItem>
);

interface HelpMenuProps {
  outlineButtonClass: string;
  onOpenHelpDialog: () => void;
  onOpenAboutDialog: () => void;
  onOpenKeyboardShortcuts: () => void;
  onShowWelcomeGuide?: () => void;
  onOpenFeedback: () => void;
}

/**
 * "Help" menu — also hosts the (lower-frequency) Community links as a labeled
 * section, so the top bar carries one fewer standalone dropdown.
 */
export const HelpMenu: React.FC<HelpMenuProps> = ({
  outlineButtonClass,
  onOpenHelpDialog,
  onOpenAboutDialog,
  onOpenKeyboardShortcuts,
  onShowWelcomeGuide,
  onOpenFeedback,
}) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title={t('menu.help.title')}>
          <HelpCircle className="size-4" />
          <span className="hidden xl:inline">{t('menu.help.title')}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuItem onClick={onOpenHelpDialog}>
          <BookOpen className="mr-2 size-4" />
          {t('menu.help.howItWorks')}
        </DropdownMenuItem>
        {onShowWelcomeGuide && (
          <DropdownMenuItem onClick={onShowWelcomeGuide}>
            <PlayCircle className="mr-2 size-4" />
            {t('menu.help.startTutorial')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenKeyboardShortcuts}>
          <Keyboard className="mr-2 size-4" />
          {t('menu.help.keyboardShortcuts')}
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAboutDialog}>
          <Info className="mr-2 size-4" />
          {t('menu.help.aboutBesser')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('menu.community.title')}</DropdownMenuLabel>
        <ExternalLinkItem href={COMMUNITY_URLS.contribute} icon={<GitPullRequest className="mr-2 size-4" />}>
          {t('menu.community.contribute')}
        </ExternalLinkItem>
        <ExternalLinkItem href={COMMUNITY_URLS.repository} icon={<FolderGit2 className="mr-2 size-4" />}>
          {t('menu.community.githubRepository')}
        </ExternalLinkItem>
        <DropdownMenuItem onClick={onOpenFeedback}>
          <MessageSquare className="mr-2 size-4" />
          {t('menu.community.sendFeedback')}
        </DropdownMenuItem>
        <ExternalLinkItem href={bugReportURL} icon={<Bug className="mr-2 size-4" />}>
          {t('menu.community.reportProblem')}
        </ExternalLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
