import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  // Redeploys reuse the existing render.yaml suffix so the live frontend URL
  // is stable. On a first deploy we still send the user through Render's
  // "Create Blueprint" flow since no services exist yet.
  const deploymentType = deploymentResult?.deployment_type ?? 'webapp';
  const isAgentDeployment = deploymentType === 'agent';
  const isRedeploy = deploymentResult?.is_first_deploy === false;
  const liveFrontend = deploymentResult?.deployment_urls.live_frontend;
  const liveAgent = deploymentResult?.deployment_urls.live_chatbot;
  const renderUrl = deploymentResult?.deployment_urls.render;
  const liveTarget = isAgentDeployment ? liveAgent : liveFrontend;
  const primaryUrl = isRedeploy && liveTarget ? liveTarget : renderUrl;
  const primaryLabel = isRedeploy && liveTarget
    ? (isAgentDeployment ? t('deploy.result.openLiveAgent') : t('deploy.result.openLiveApp'))
    : t('deploy.result.openRenderDeployment');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isRedeploy
              ? (isAgentDeployment ? t('deploy.result.titleUpdatedAgent') : t('deploy.result.titleUpdated'))
              : (isAgentDeployment ? t('deploy.result.titleCreatedAgent') : t('deploy.result.titleCreated'))}
          </DialogTitle>
          <DialogDescription>
            {isRedeploy
              ? (isAgentDeployment
                ? t('deploy.result.descUpdatedAgent')
                : t('deploy.result.descUpdated'))
              : (isAgentDeployment
                ? t('deploy.result.descCreatedAgent')
                : t('deploy.result.descCreated'))}
          </DialogDescription>
        </DialogHeader>
        {deploymentResult && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <p className="font-medium">
                {deploymentResult.owner}/{deploymentResult.repo_name}
              </p>
              <p className="text-xs">{t('deploy.result.filesUploaded', { count: deploymentResult.files_uploaded })}</p>
            </div>
            {isRedeploy && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <p className="font-medium">{t('deploy.result.notSeeingChanges')}</p>
                <p className="mt-1 text-xs">
                  {t('deploy.result.manualSyncIntro')}{' '}
                  <span className="font-semibold">{t('deploy.result.manualSyncLabel')}</span>
                  {isAgentDeployment ? t('deploy.result.manualSyncBodyAgent') : t('deploy.result.manualSyncBody')}
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
                {t('deploy.result.openBlueprint')}
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenExternal(deploymentResult.repo_url)}
            >
              {t('deploy.result.viewRepo')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
