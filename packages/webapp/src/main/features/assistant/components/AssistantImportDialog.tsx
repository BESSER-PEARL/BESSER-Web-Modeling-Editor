import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const isImageMode = mode === 'image';
  const canImport = Boolean(apiKey && selectedFile && !error && !isImporting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isImageMode ? t('assistant.import.titleImage') : t('assistant.import.titleKg')}
          </DialogTitle>
          <DialogDescription>
            {t('assistant.import.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-import-api-key">{t('assistant.import.apiKeyLabel')}</Label>
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
              {isImageMode ? t('assistant.import.uploadImageLabel') : t('assistant.import.uploadKgLabel')}
            </Label>
            <input
              id="assistant-import-file"
              type="file"
              accept={isImageMode ? 'image/png, image/jpeg' : '.ttl,.rdf,.json'}
              onChange={onFileChange}
              className="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground/80"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {selectedFile && <p className="text-xs text-muted-foreground">{t('assistant.import.selected', { name: selectedFile.name })}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onImport} disabled={!canImport} className="bg-brand text-brand-foreground hover:bg-brand-dark">
            {isImporting ? t('assistant.import.importing') : t('assistant.import.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
