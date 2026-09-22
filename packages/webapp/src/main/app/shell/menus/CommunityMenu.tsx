import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bugReportURL } from '../../../shared/constants/constant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommunityMenuProps {
  outlineButtonClass: string;
  onOpenFeedback: () => void;
}

const COMMUNITY_URLS = {
  contribute: 'https://github.com/BESSER-PEARL/BESSER/blob/master/CONTRIBUTING.md',
  repository: 'https://github.com/BESSER-PEARL/BESSER',
  survey: 'https://docs.google.com/forms/d/e/1FAIpQLSdhYVFFu8xiFkoV4u6Pgjf5F7-IS_W7aTj34N5YS2L143vxoQ/viewform',
};

export const CommunityMenu: React.FC<CommunityMenuProps> = ({
  outlineButtonClass,
  onOpenFeedback,
}) => {
  const { t } = useTranslation();

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title={t('menu.community.title')}>
          <Users className="size-4" />
          <span className="hidden xl:inline">{t('menu.community.title')}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
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
