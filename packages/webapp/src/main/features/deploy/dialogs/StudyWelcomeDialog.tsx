import React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, FlaskConical, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STUDY_FORM_BASE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScjqyRv9uH7M7UYQStrdoBko5v7q2yUax4uRGLrI8AS_YQKkQ/viewform' +
  '?usp=pp_url&entry.153355410=';

interface StudyWelcomeDialogProps {
  open: boolean;
  participantId: string;
  onConfirm: () => void;
}

export const StudyWelcomeDialog: React.FC<StudyWelcomeDialogProps> = ({ open, participantId, onConfirm }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const formUrl = STUDY_FORM_BASE_URL + encodeURIComponent(participantId);

  const handleCopy = () => {
    navigator.clipboard.writeText(participantId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <FlaskConical className="size-5 text-brand" />
            <DialogTitle>{t('study.welcome.title')}</DialogTitle>
          </div>
          <DialogDescription>{t('study.welcome.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('study.welcome.idIntro')}</p>

          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="min-w-0 flex-1 font-mono text-sm tracking-wide">{participantId}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded p-1 hover:bg-muted"
              title={t('study.welcome.copyId')}
            >
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </button>
          </div>

          {copied && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('study.welcome.idCopied')}</p>
          )}

          <p className="text-sm text-muted-foreground">{t('study.welcome.idNote')}</p>

          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-brand underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            {t('study.welcome.formLink')}
          </a>
        </div>

        <DialogFooter>
          <Button className="w-full bg-brand text-brand-foreground hover:bg-brand-dark" onClick={onConfirm}>
            {t('study.welcome.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
