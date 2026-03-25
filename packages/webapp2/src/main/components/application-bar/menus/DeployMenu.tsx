import React from 'react';
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} title="Deploy">
          <Rocket className="h-4 w-4" />
          <span className="hidden xl:inline">Deploy</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>Deployment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isAuthenticated && (
          <DropdownMenuItem onClick={onGitHubLogin} disabled={githubLoading}>
            {githubLoading ? 'Connecting...' : 'Connect GitHub to Deploy'}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenDeployDialog} disabled={!isDeploymentAvailable}>
          Publish Web App to Render
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
