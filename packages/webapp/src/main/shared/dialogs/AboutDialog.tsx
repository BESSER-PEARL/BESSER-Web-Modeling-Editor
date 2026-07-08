import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMainRepository: () => void;
  onOpenWmeRepository: () => void;
  onOpenLibraryRepository: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  open,
  onOpenChange,
  onOpenMainRepository,
  onOpenWmeRepository,
  onOpenLibraryRepository,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('dialogs.about.title')}</DialogTitle>
          <DialogDescription>{t('dialogs.about.tagline')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm text-foreground/80">
          <p>{t('dialogs.about.para1')}</p>
          <p>
            <Trans
              i18nKey="dialogs.about.para2"
              components={{ brand: <span className="font-semibold text-brand" /> }}
            />
          </p>
          <p className="text-xs text-muted-foreground">{t('dialogs.about.para3')}</p>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-start sm:space-x-0">
          <Button variant="outline" onClick={onOpenMainRepository}>
            {t('dialogs.about.besserRepository')}
          </Button>
          <Button variant="outline" onClick={onOpenWmeRepository}>
            {t('dialogs.about.wmeRepository')}
          </Button>
          <Button variant="outline" onClick={onOpenLibraryRepository}>
            {t('dialogs.about.libraryRepository')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
