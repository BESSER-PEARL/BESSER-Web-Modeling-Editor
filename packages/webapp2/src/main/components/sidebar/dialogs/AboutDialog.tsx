import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AboutDialogProps {
  open: boolean;
  appVersion: string;
  libraryVersion: string;
  onOpenChange: (open: boolean) => void;
  onOpenWmeRepository: () => void;
  onOpenLibraryRepository: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  open,
  appVersion,
  libraryVersion,
  onOpenChange,
  onOpenWmeRepository,
  onOpenLibraryRepository,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>About BESSER</DialogTitle>
          <DialogDescription>Runtime versions and project resources.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm text-foreground/80">
          <p>
            <span className="font-semibold text-brand">Web Editor:</span> {appVersion}
          </p>
          <p>
            <span className="font-semibold text-brand">BESSER Library:</span> {libraryVersion}
          </p>
          <p className="pt-1 text-xs text-muted-foreground">
            BESSER provides model-driven engineering tooling for UML-based design, code generation, and deployment.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onOpenWmeRepository}>
            WME Repository
          </Button>
          <Button variant="outline" onClick={onOpenLibraryRepository}>
            Library Repository
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
