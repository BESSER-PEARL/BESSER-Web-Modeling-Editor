import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { t } = useTranslation();
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
    ? t('deploy.dialog.existingAgent')
    : t('deploy.dialog.existing');
  const newRepoText = isAgentDeploy
    ? t('deploy.dialog.newAgent')
    : t('deploy.dialog.new');
  const publishLabel = isAgentDeploy
    ? (useExistingRepo ? t('deploy.actions.updatePublishAgent') : t('deploy.actions.publishAgent'))
    : (useExistingRepo ? t('deploy.actions.updatePublish') : t('deploy.actions.publish'));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('deploy.dialog.publishTitle')}</DialogTitle>
          <DialogDescription>
            {useExistingRepo
              ? existingRepoText
              : newRepoText}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isDeploying && validation.isValid) onPublish();
          }}
        >
        <div className="flex flex-col gap-4">
          {availableTargets.length > 1 && (
            <FormField label={t('deploy.fields.deploymentTarget')} htmlFor="deploy-target">
              <Select value={deploymentTarget} onValueChange={(value) => value && onDeploymentTargetChange(value as DeploymentTarget)}>
                <SelectTrigger id="deploy-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.includes('webapp') && (
                    <SelectItem value="webapp">{t('deploy.targets.webapp')}</SelectItem>
                  )}
                  {availableTargets.includes('agent') && (
                    <SelectItem value="agent">{t('deploy.targets.agent')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {useExistingRepo && linkedRepo ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={`${linkedRepo.owner}/${linkedRepo.repo}`}>
                    {t('deploy.existing.previouslyDeployed')}{' '}
                    <a
                      href={`https://github.com/${linkedRepo.owner}/${linkedRepo.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {linkedRepo.owner}/{linkedRepo.repo}
                    </a>
                  </p>
                  <p className="text-xs">{t('deploy.existing.filesPreserved')}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onCreateNewInstead}>
                  {t('deploy.existing.createNewInstead')}
                </Button>
              </div>
              <FormField label={t('deploy.fields.commitMessage')} htmlFor="deploy-commit-message" helperText={t('deploy.fields.commitMessageHelper')}>
                <Input
                  id="deploy-commit-message"
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                  placeholder={t('deploy.fields.commitMessagePlaceholder')}
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label={t('deploy.fields.repoName')} htmlFor="deploy-repo-name" required error={validation.getError('repoName')}>
                <Input
                  id="deploy-repo-name"
                  name="repo-name"
                  autoComplete="off"
                  spellCheck={false}
                  value={repoName}
                  onChange={(event) => onRepoNameChange(event.target.value)}
                  onBlur={() => validation.markTouched('repoName')}
                  placeholder={t('deploy.fields.repoNamePlaceholder')}
                  className={validation.getError('repoName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                />
              </FormField>
              <FormField label={t('deploy.fields.description')} htmlFor="deploy-repo-description">
                <Input
                  id="deploy-repo-description"
                  value={repoDescription}
                  onChange={(event) => onRepoDescriptionChange(event.target.value)}
                  placeholder={t('deploy.fields.descriptionPlaceholder')}
                />
              </FormField>
              <div className="flex items-center gap-2">
                <Checkbox id="deploy-repo-private" checked={repoPrivate} onCheckedChange={onRepoPrivateChange} />
                <Label htmlFor="deploy-repo-private" className="font-normal">
                  {t('deploy.fields.makePrivate')}
                </Label>
              </div>
              {repoPrivate && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {t('deploy.privateWarning')}
                </p>
              )}
            </>
          )}

          {isAgentDeploy && showPersonalizationOption && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="deploy-include-personalization"
                  checked={includePersonalization}
                  onCheckedChange={onIncludePersonalizationChange}
                />
                <Label htmlFor="deploy-include-personalization" className="font-normal">
                  {t('deploy.fields.personalization')}
                </Label>
              </div>
              {includePersonalization && (
                <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                  {t('deploy.personalizationNote')}
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeploying}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isDeploying || !validation.isValid}>
            {isDeploying ? t('deploy.actions.publishing') : publishLabel}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
