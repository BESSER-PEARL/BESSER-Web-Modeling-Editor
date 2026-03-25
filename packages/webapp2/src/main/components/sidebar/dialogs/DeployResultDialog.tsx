import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DeployToGitHubResult } from '../../../services/deploy/useGitHubDeploy';

interface DeployResultDialogProps {
  open: boolean;
  deploymentResult: DeployToGitHubResult | null;
  onOpenChange: (open: boolean) => void;
  onOpenRender: () => void;
  onOpenRepository: () => void;
}

export const DeployResultDialog: React.FC<DeployResultDialogProps> = ({
  open,
  deploymentResult,
  onOpenChange,
  onOpenRender,
  onOpenRepository,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {deploymentResult?.message?.includes('updated') ? 'Repository Updated Successfully' : 'Repository Created Successfully'}
          </DialogTitle>
          <DialogDescription>
            Continue with one-click Render deployment or inspect the generated repository.
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
            <Button className="w-full bg-brand text-brand-foreground hover:bg-brand-dark" onClick={onOpenRender}>
              Open Render Deployment
            </Button>
            <Button variant="outline" className="w-full" onClick={onOpenRepository}>
              View GitHub Repository
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
