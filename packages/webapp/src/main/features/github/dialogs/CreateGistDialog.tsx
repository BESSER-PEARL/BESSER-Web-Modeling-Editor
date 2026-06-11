import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateGistDialogProps {
  open: boolean;
  isLoading: boolean;
  description: string;
  isPublic: boolean;
  onOpenChange: (open: boolean) => void;
  onDescriptionChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  onCreate: () => void;
}

export const CreateGistDialog: React.FC<CreateGistDialogProps> = ({
  open,
  isLoading,
  description,
  isPublic,
  onOpenChange,
  onDescriptionChange,
  onPublicChange,
  onCreate,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Gist</DialogTitle>
          <DialogDescription>Create a GitHub Gist to quickly share your project.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              placeholder="Gist description..."
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => onPublicChange(event.target.checked)}
              className="size-4 rounded border-border"
            />
            Public Gist
          </label>

          <p className="text-xs text-muted-foreground">
            Secret gists are hidden from search engines but visible to anyone with the link.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Gist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
