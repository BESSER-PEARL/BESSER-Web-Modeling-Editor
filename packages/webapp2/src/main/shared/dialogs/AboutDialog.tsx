import React from 'react';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>About BESSER</DialogTitle>
          <DialogDescription>Building Better Smart Software Faster</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm text-foreground/80">
          <p>
            BESSER is a low-code platform for smart software modeling and code generation.
            It provides a Python-based metamodel (B-UML) for describing domain models, state machines,
            GUI designs, agents, and more.
          </p>
          <p>
            The <span className="font-semibold text-brand">Web Modeling Editor</span> is the online visual
            editor for creating and editing BESSER models, generating code, and deploying applications.
          </p>
          <p className="text-xs text-muted-foreground">
            Developed by the BESSER-PEARL research group at the University of Luxembourg.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onOpenMainRepository}>
            BESSER Repository
          </Button>
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
