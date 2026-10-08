import React from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, ChevronDown, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeaderTooltip } from './HeaderTooltip';

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
  const title = t('menu.deploy.title');
  return (
    <DropdownMenu>
      <HeaderTooltip label={title} hideFrom="xl">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`gap-2 ${outlineButtonClass}`} aria-label={title}>
            <Rocket className="size-4" aria-hidden="true" />
            <span className="hidden xl:inline">{title}</span>
            <ChevronDown className="hidden size-3 opacity-50 md:block" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </HeaderTooltip>
      <DropdownMenuContent className="w-72" align="end">
        {!isAuthenticated && (
          <DropdownMenuItem onClick={onGitHubLogin} disabled={githubLoading}>
            <Github className="mr-2 size-4" />
            {githubLoading ? t('common.connecting') : t('menu.deploy.connectGitHub')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={publishEnabled ? onOpenDeployDialog : undefined}
          disabled={!publishEnabled}
          aria-describedby={publishHint ? 'deploy-publish-hint' : undefined}
        >
          <Rocket className="mr-2 size-4" />
          {t('menu.deploy.publishToRender')}
        </DropdownMenuItem>
        {publishHint && (
          <p id="deploy-publish-hint" className="-mt-1 pb-1.5 pl-8 pr-2 text-xs text-muted-foreground">
            {publishHint}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
