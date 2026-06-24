import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Keyboard, PlayCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bugReportURL } from '../../../shared/constants/constant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const USER_STUDY_PDF_URL = '/Low_code_CA_personalization_study_instructions.pdf';

const COMMUNITY_URLS = {
  contribute: 'https://github.com/BESSER-PEARL/BESSER/blob/master/CONTRIBUTING.md',
  repository: 'https://github.com/BESSER-PEARL/BESSER',
  survey: 'https://docs.google.com/forms/d/e/1FAIpQLSdhYVFFu8xiFkoV4u6Pgjf5F7-IS_W7aTj34N5YS2L143vxoQ/viewform',
};

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
  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const openUserStudyPdf = () => openExternalUrl(USER_STUDY_PDF_URL);

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
        <DropdownMenuItem onClick={onOpenHelpDialog}>{t('menu.help.howItWorks')}</DropdownMenuItem>
        <DropdownMenuItem onClick={openUserStudyPdf}>{t('menu.help.userStudyPdf')}</DropdownMenuItem>
        {onShowWelcomeGuide && (
          <DropdownMenuItem onClick={onShowWelcomeGuide}>
            <PlayCircle className="mr-2 size-4" />
            {t('menu.help.startTutorial')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenKeyboardShortcuts}>
          <Keyboard className="mr-2 size-4" />
          {t('menu.help.keyboardShortcuts')}
          <span className="ml-auto text-xs text-muted-foreground">?</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAboutDialog}>{t('menu.help.aboutBesser')}</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('menu.community.title')}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.contribute)}>
          {t('menu.community.contribute')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.repository)}>
          {t('menu.community.githubRepository')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenFeedback}>{t('menu.community.sendFeedback')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(COMMUNITY_URLS.survey)}>
          {t('menu.community.userSurvey')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openExternalUrl(bugReportURL)}>
          {t('menu.community.reportProblem')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
