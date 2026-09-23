import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StudyDeployResult } from '../hooks/useStudyDeploy';

interface StudyDeployDialogProps {
  open: boolean;
  isDeploying: boolean;
  result: StudyDeployResult | null;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onDeploy: () => void;
  onOpenAgent: (url: string) => void;
}

export const StudyDeployDialog: React.FC<StudyDeployDialogProps> = ({
  open,
  isDeploying,
  result,
  error,
  onOpenChange,
  onDeploy,
  onOpenAgent,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deploy.study.dialogTitle')}</DialogTitle>
          {!isDeploying && !result && !error && (
            <DialogDescription>{t('deploy.study.dialogDesc')}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isDeploying && (
            <div className="flex items-center gap-3 rounded-md border border-border/70 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span>{t('deploy.study.deploying')}</span>
            </div>
          )}

          {result?.success && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">{t('deploy.study.successTitle')}</p>
                  <p className="mt-0.5 text-xs opacity-80">{t('deploy.study.successDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1 truncate font-mono">{result.url}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(result.url)}
                  className="shrink-0 rounded p-1 hover:bg-muted"
                  title={t('deploy.study.copyUrl')}
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              {copied && (
                <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">
                  {t('deploy.study.urlCopied')}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{t('deploy.study.errorTitle')}</p>
                <p className="mt-0.5 text-xs opacity-80">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isDeploying}>
            {t('common.close')}
          </Button>

          {result?.success ? (
            <Button
              className="gap-2 bg-brand text-brand-foreground hover:bg-brand-dark"
              onClick={() => onOpenAgent(result.url)}
            >
              <ExternalLink className="size-4" />
              {t('deploy.study.openAgent')}
            </Button>
          ) : (
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand-dark"
              onClick={onDeploy}
              disabled={isDeploying}
            >
              {error ? t('deploy.study.retry') : t('deploy.study.deploy')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
