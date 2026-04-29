import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { validateRepoName } from '../../../shared/utils/validation';
import { useFieldValidation } from '../../../shared/hooks/useFieldValidation';

interface LinkedRepo {
  owner: string;
  repo: string;
}

type DeploymentTarget = 'webapp' | 'agent';

interface DeployDialogProps {
  open: boolean;
  isDeploying: boolean;
  repoName: string;
  repoDescription: string;
  repoPrivate: boolean;
  useExistingRepo: boolean;
  linkedRepo: LinkedRepo | null;
  commitMessage: string;
  deploymentTarget: DeploymentTarget;
  availableTargets: DeploymentTarget[];
  includePersonalization: boolean;
  showPersonalizationOption: boolean;
  onOpenChange: (open: boolean) => void;
  onDeploymentTargetChange: (value: DeploymentTarget) => void;
  onRepoNameChange: (value: string) => void;
  onRepoDescriptionChange: (value: string) => void;
  onRepoPrivateChange: (value: boolean) => void;
  onCommitMessageChange: (value: string) => void;
  onIncludePersonalizationChange: (value: boolean) => void;
  onCreateNewInstead: () => void;
  onPublish: () => void;
}

export const DeployDialog: React.FC<DeployDialogProps> = ({
  open,
  isDeploying,
  repoName,
  repoDescription,
  repoPrivate,
  useExistingRepo,
  linkedRepo,
  commitMessage,
  deploymentTarget,
  availableTargets,
  includePersonalization,
  showPersonalizationOption,
  onOpenChange,
  onDeploymentTargetChange,
  onRepoNameChange,
  onRepoDescriptionChange,
  onRepoPrivateChange,
  onCommitMessageChange,
  onIncludePersonalizationChange,
  onCreateNewInstead,
  onPublish,
}) => {
  // ── Inline validation (only for create-new-repo mode) ──────────────────
  const validators = useMemo(() => ({
    repoName: () => useExistingRepo ? undefined : validateRepoName(repoName),
  }), [repoName, useExistingRepo]);
  const validation = useFieldValidation(validators);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      validation.resetTouched();
    }
  };

  const isAgentDeploy = deploymentTarget === 'agent';
  const existingRepoText = isAgentDeploy
    ? 'Update the existing agent repository with your latest changes.'
    : 'Update the existing repository with your latest changes.';
  const newRepoText = isAgentDeploy
    ? 'Create a GitHub repository from the active Agent diagram and deploy a standalone agent on Render.'
    : 'Create a GitHub repository from the current project and deploy it on Render.';
  const publishLabel = isAgentDeploy
    ? (useExistingRepo ? 'Update & Publish Agent' : 'Publish Agent to Render')
    : (useExistingRepo ? 'Update & Publish' : 'Publish to Render');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish to Render</DialogTitle>
          <DialogDescription>
            {useExistingRepo
              ? existingRepoText
              : newRepoText}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {availableTargets.length > 1 && (
            <FormField label="Deployment Target" htmlFor="deploy-target">
              <select
                id="deploy-target"
                value={deploymentTarget}
                onChange={(event) => onDeploymentTargetChange(event.target.value as DeploymentTarget)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {availableTargets.includes('webapp') && (
                  <option value="webapp">Web App (Class + GUI)</option>
                )}
                {availableTargets.includes('agent') && (
                  <option value="agent">Standalone Agent</option>
                )}
              </select>
            </FormField>
          )}

          {useExistingRepo && linkedRepo ? (
            <>
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <div>
                  <p className="font-medium">
                    Previously deployed to:{' '}
                    <a
                      href={`https://github.com/${linkedRepo.owner}/${linkedRepo.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {linkedRepo.owner}/{linkedRepo.repo}
                    </a>
                  </p>
                  <p className="text-xs">Files you added manually will be preserved.</p>
                </div>
                <Button variant="outline" size="sm" onClick={onCreateNewInstead}>
                  Create new repo instead
                </Button>
              </div>
              <FormField label="Commit Message" htmlFor="deploy-commit-message" helperText="Describe what changed (leave empty for default message)">
                <Input
                  id="deploy-commit-message"
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                  placeholder="Update app"
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Repository Name" htmlFor="deploy-repo-name" required error={validation.getError('repoName')}>
                <Input
                  id="deploy-repo-name"
                  value={repoName}
                  onChange={(event) => onRepoNameChange(event.target.value)}
                  onBlur={() => validation.markTouched('repoName')}
                  placeholder="my-awesome-app"
                  className={validation.getError('repoName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                />
              </FormField>
              <FormField label="Description" htmlFor="deploy-repo-description">
                <Input
                  id="deploy-repo-description"
                  value={repoDescription}
                  onChange={(event) => onRepoDescriptionChange(event.target.value)}
                  placeholder="Web application generated by BESSER"
                />
              </FormField>
              <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
                Make repository private
                <input
                  type="checkbox"
                  checked={repoPrivate}
                  onChange={(event) => onRepoPrivateChange(event.target.checked)}
                />
              </label>
              {repoPrivate && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  Private repositories may require manual Render permission setup.
                </p>
              )}
            </>
          )}

          {isAgentDeploy && showPersonalizationOption && (
            <>
              <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
                Personalization
                <input
                  type="checkbox"
                  checked={includePersonalization}
                  onChange={(event) => onIncludePersonalizationChange(event.target.checked)}
                />
              </label>
              {includePersonalization && (
                <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                  The deployed agent will authenticate users and serve the personalized variant matching each user's profile.
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeploying}>
            Cancel
          </Button>
          <Button onClick={onPublish} disabled={isDeploying || !validation.isValid} className="bg-brand text-brand-foreground hover:bg-brand-dark">
            {isDeploying ? 'Publishing...' : publishLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
