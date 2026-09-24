import React from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENABLE_STUDY_DEPLOY } from '../../../shared/constants/constant';
import { getPostHog } from '../../../shared/services/analytics/lazy-analytics';

interface DeployMenuProps {
  outlineButtonClass: string;
  showXlLabels?: boolean;
  isAuthenticated: boolean;
  githubLoading: boolean;
  isDeploymentAvailable: boolean;
  onGitHubLogin: () => void;
  onOpenDeployDialog: () => void;
  onOpenStudyDeployDialog?: () => void;
}

export const DeployMenu: React.FC<DeployMenuProps> = ({
  outlineButtonClass,
  showXlLabels,
  isAuthenticated,
  githubLoading,
  isDeploymentAvailable,
  onGitHubLogin,
  onOpenDeployDialog,
  onOpenStudyDeployDialog,
}) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu onOpenChange={(open) => { if (open) getPostHog()?.capture('deploy_menu_opened'); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title={t('menu.deploy.title')}>
          <Rocket className="size-4" />
          <span className={showXlLabels !== undefined ? (showXlLabels ? '' : 'hidden') : 'hidden xl:inline'}>{t('menu.deploy.title')}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>{t('menu.deploy.deployment')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isAuthenticated && (
          <DropdownMenuItem onClick={onGitHubLogin} disabled={githubLoading}>
            {githubLoading ? t('common.connecting') : t('menu.deploy.connectGitHub')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenDeployDialog} disabled={!isDeploymentAvailable}>
          {t('menu.deploy.publishToRender')}
        </DropdownMenuItem>
        {ENABLE_STUDY_DEPLOY && (
          <DropdownMenuItem onClick={onOpenStudyDeployDialog} disabled={!isDeploymentAvailable}>
            {t('deploy.study.menuItem')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
