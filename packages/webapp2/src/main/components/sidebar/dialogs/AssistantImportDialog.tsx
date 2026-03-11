import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type AssistantImportMode = 'image' | 'kg' | null;

interface AssistantImportDialogProps {
  open: boolean;
  mode: AssistantImportMode;
  apiKey: string;
  selectedFile: File | null;
  error: string;
  isImporting: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeyChange: (value: string) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
}

export const AssistantImportDialog: React.FC<AssistantImportDialogProps> = ({
  open,
  mode,
  apiKey,
  selectedFile,
  error,
  isImporting,
  onOpenChange,
  onApiKeyChange,
  onFileChange,
  onImport,
}) => {
  const isImageMode = mode === 'image';
  const canImport = Boolean(apiKey && selectedFile && !error && !isImporting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isImageMode ? 'Import Class Diagram from Image' : 'Import Class Diagram from Knowledge Graph'}
          </DialogTitle>
          <DialogDescription>
            Use an OpenAI API key to convert your file to a class diagram and add it to the current project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-import-api-key">OpenAI API Key</Label>
            <Input
              id="assistant-import-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assistant-import-file">
              {isImageMode ? 'Upload Diagram Image (PNG/JPEG)' : 'Upload Knowledge Graph (TTL/RDF/JSON)'}
            </Label>
            <input
              id="assistant-import-file"
              type="file"
              accept={isImageMode ? 'image/png, image/jpeg' : '.ttl,.rdf,.json'}
              onChange={onFileChange}
              className="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground/80"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {selectedFile && <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={onImport} disabled={!canImport} className="bg-[#397C95] text-white hover:bg-[#2C6A82]">
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
