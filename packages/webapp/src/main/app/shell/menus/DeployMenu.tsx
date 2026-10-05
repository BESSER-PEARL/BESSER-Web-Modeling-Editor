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
  // Publishing needs a GitHub session; disable it (with a reason) instead of a click that only toasts.
  const publishEnabled = isDeploymentAvailable && isAuthenticated;
  const publishHint = !isAuthenticated
    ? t('menu.deploy.connectGitHubFirstHint', { defaultValue: 'Connect GitHub first' })
    : !isDeploymentAvailable
      ? t('deploy.toasts.availableFor')
      : null;
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
        <DropdownMenuItem
          onClick={publishEnabled ? onOpenDeployDialog : undefined}
          disabled={!publishEnabled}
          aria-describedby={publishHint ? 'deploy-publish-hint' : undefined}
        >
          {t('menu.deploy.publishToRender')}
        </DropdownMenuItem>
        {publishHint && (
          <p id="deploy-publish-hint" className="-mt-1 px-2 pb-1.5 text-xs text-muted-foreground">
            {publishHint}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
