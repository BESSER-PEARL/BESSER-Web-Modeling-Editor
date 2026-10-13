import React, { useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EDITOR_VERSION } from '../constants/constant';

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
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="focus:outline-none sm:max-w-xl"
        // Auto-focusing the first link button paints its ring on a mouse open; focus the dialog itself.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('dialogs.about.title')}</DialogTitle>
          <DialogDescription>{t('dialogs.about.tagline')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-pretty text-sm text-foreground/80">
          <p>{t('dialogs.about.para1')}</p>
          <p>
            <Trans
              i18nKey="dialogs.about.para2"
              components={{ brand: <span className="font-semibold text-brand" /> }}
            />
          </p>
          {EDITOR_VERSION && <p className="ui-kicker">{t('dialogs.about.version', { version: EDITOR_VERSION })}</p>}
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
