import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DeployToGitHubResult } from '../../github/hooks/useGitHubDeploy';

interface DeployResultDialogProps {
  open: boolean;
  deploymentResult: DeployToGitHubResult | null;
  onOpenChange: (open: boolean) => void;
  onOpenExternal: (url: string) => void;
}

export const DeployResultDialog: React.FC<DeployResultDialogProps> = ({
  open,
  deploymentResult,
  onOpenChange,
  onOpenExternal,
}) => {
  // Redeploys reuse the existing render.yaml suffix, so the backend already
  // knows the live frontend URL and Render's blueprint webhook will auto-sync
  // the push. First deploys have no stable hostname yet, so we still send the
  // user through Render's "Create Blueprint" flow.
  const isRedeploy = deploymentResult?.is_first_deploy === false;
  const liveFrontend = deploymentResult?.deployment_urls.live_frontend;
  const renderUrl = deploymentResult?.deployment_urls.render;
  const primaryUrl = isRedeploy && liveFrontend ? liveFrontend : renderUrl;
  const primaryLabel = isRedeploy && liveFrontend ? 'Open Live App' : 'Open Render Deployment';
  const primaryDescription = isRedeploy && liveFrontend
    ? 'Your push was picked up by Render\u2019s blueprint webhook; the existing services are redeploying in place.'
    : 'Continue with one-click Render deployment or inspect the generated repository.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isRedeploy ? 'Repository Updated Successfully' : 'Repository Created Successfully'}
          </DialogTitle>
          <DialogDescription>{primaryDescription}</DialogDescription>
        </DialogHeader>
        {deploymentResult && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <p className="font-medium">
                {deploymentResult.owner}/{deploymentResult.repo_name}
              </p>
              <p className="text-xs">{deploymentResult.files_uploaded} files uploaded.</p>
            </div>
            {primaryUrl && (
              <Button
                className="w-full bg-brand text-brand-foreground hover:bg-brand-dark"
                onClick={() => onOpenExternal(primaryUrl)}
              >
                {primaryLabel}
              </Button>
            )}
            {isRedeploy && deploymentResult.deployment_urls.render_dashboard && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenExternal(deploymentResult.deployment_urls.render_dashboard as string)}
              >
                View Render Dashboard
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenExternal(deploymentResult.repo_url)}
            >
              View GitHub Repository
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
