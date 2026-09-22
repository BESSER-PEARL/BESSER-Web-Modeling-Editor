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

interface DeployMenuProps {
  outlineButtonClass: string;
  isAuthenticated: boolean;
  githubLoading: boolean;
  isDeploymentAvailable: boolean;
  onGitHubLogin: () => void;
  onOpenDeployDialog: () => void;
}

export const DeployMenu: React.FC<DeployMenuProps> = ({
  outlineButtonClass,
  isAuthenticated,
  githubLoading,
  isDeploymentAvailable,
  onGitHubLogin,
  onOpenDeployDialog,
}) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title={t('menu.deploy.title')}>
          <Rocket className="size-4" />
          <span className="hidden xl:inline">{t('menu.deploy.title')}</span>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
