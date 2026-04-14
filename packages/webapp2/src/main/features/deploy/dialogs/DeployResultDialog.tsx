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
  // Redeploys reuse the existing render.yaml suffix so the live frontend URL
  // is stable. On a first deploy we still send the user through Render's
  // "Create Blueprint" flow since no services exist yet.
  const isRedeploy = deploymentResult?.is_first_deploy === false;
  const liveFrontend = deploymentResult?.deployment_urls.live_frontend;
  const renderUrl = deploymentResult?.deployment_urls.render;
  const primaryUrl = isRedeploy && liveFrontend ? liveFrontend : renderUrl;
  const primaryLabel = isRedeploy && liveFrontend ? 'Open Live App' : 'Open Render Deployment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isRedeploy ? 'Repository Updated Successfully' : 'Repository Created Successfully'}
          </DialogTitle>
          <DialogDescription>
            {isRedeploy
              ? 'Your changes were pushed to GitHub. Trigger a redeploy on Render to pick them up.'
              : 'Continue with one-click Render deployment or inspect the generated repository.'}
          </DialogDescription>
        </DialogHeader>
        {deploymentResult && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <p className="font-medium">
                {deploymentResult.owner}/{deploymentResult.repo_name}
              </p>
              <p className="text-xs">{deploymentResult.files_uploaded} files uploaded.</p>
            </div>
            {isRedeploy && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <p className="font-medium">Don&rsquo;t see your changes yet?</p>
                <p className="mt-1 text-xs">
                  Open your Blueprint on Render and click{' '}
                  <span className="font-semibold">Manual Sync</span>. That redeploys every
                  service in the blueprint (backend, frontend, agents) from the latest commit in
                  one click. Render&rsquo;s auto-deploy can miss pushes when the GitHub App
                  isn&rsquo;t granted access to the repo, so Manual Sync is the reliable path.
                </p>
              </div>
            )}
            {primaryUrl && (
              <Button
                className="w-full bg-brand text-brand-foreground hover:bg-brand-dark"
                onClick={() => onOpenExternal(primaryUrl)}
              >
                {primaryLabel}
              </Button>
            )}
            {isRedeploy && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenExternal('https://dashboard.render.com/blueprints')}
              >
                Open Render Blueprint
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
