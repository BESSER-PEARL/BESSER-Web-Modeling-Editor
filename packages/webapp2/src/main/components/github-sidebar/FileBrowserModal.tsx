import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Check, FileText, Folder, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GitHubContentItem } from '../../services/github/useGitHubStorage';

interface FileBrowserModalProps {
  show: boolean;
  onHide: () => void;
  onSelect: (path: string) => void;
  fetchContents: (path: string) => Promise<GitHubContentItem[]>;
  title?: string;
  selectMode?: 'file' | 'dir';
  initialPath?: string;
}

const itemSorter = (a: GitHubContentItem, b: GitHubContentItem): number => {
  if (a.type === b.type) {
    return a.name.localeCompare(b.name);
  }
  return a.type === 'dir' ? -1 : 1;
};

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({
  show,
  onHide,
  onSelect,
  fetchContents,
  title = 'Select File',
  selectMode = 'file',
  initialPath = '',
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [contents, setContents] = useState<GitHubContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GitHubContentItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pathSegments = useMemo(() => {
    if (!currentPath) {
      return [] as string[];
    }
    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  const loadContents = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const items = await fetchContents(path);
      setContents([...items].sort(itemSorter));
    } catch (err) {
      setError('Failed to load directory contents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!show) {
      return;
    }

    setCurrentPath(initialPath);
    setSelectedItem(null);
    loadContents(initialPath).catch(console.error);
  }, [show, initialPath]);

  const openPath = (path: string) => {
    setCurrentPath(path);
    setSelectedItem(null);
    loadContents(path).catch(console.error);
  };

  const handleItemClick = (item: GitHubContentItem) => {
    if (item.type === 'dir') {
      if (selectMode === 'dir') {
        setSelectedItem(item);
      }
      openPath(item.path);
      return;
    }

    if (selectMode === 'file') {
      setSelectedItem(item);
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath) {
      return;
    }

    const parts = currentPath.split('/');
    parts.pop();
    openPath(parts.join('/'));
  };

  const handleBreadcrumbClick = (index: number) => {
    if (!pathSegments.length) {
      return;
    }

    const newPath = pathSegments.slice(0, index + 1).join('/');
    openPath(newPath);
  };

  const handleConfirm = () => {
    if (selectMode === 'file' && selectedItem) {
      onSelect(selectedItem.path);
      onHide();
      return;
    }

    if (selectMode === 'dir') {
      onSelect(currentPath);
      onHide();
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs">
            <button
              type="button"
              onClick={() => openPath('')}
              className={cn(
                'rounded px-2 py-1 transition-colors hover:bg-accent',
                !pathSegments.length && 'bg-accent text-accent-foreground',
              )}
            >
              root
            </button>
            {pathSegments.map((segment, index) => (
              <React.Fragment key={`${segment}-${index}`}>
                <span className="text-muted-foreground">/</span>
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(index)}
                  className={cn(
                    'rounded px-2 py-1 transition-colors hover:bg-accent',
                    index === pathSegments.length - 1 && 'bg-accent text-accent-foreground',
                  )}
                >
                  {segment}
                </button>
              </React.Fragment>
            ))}
          </div>

          {currentPath && (
            <Button variant="outline" size="sm" onClick={handleNavigateUp} className="gap-1">
              <ArrowUp className="h-4 w-4" />
              Up one level
            </Button>
          )}

          <div
            className="h-80 overflow-y-scroll rounded-md border border-border/70 bg-background [scrollbar-gutter:stable]"
            style={{ scrollbarWidth: 'thin' }}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-sm text-destructive">{error}</div>
            ) : contents.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Empty directory</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {contents.map((item) => {
                  const selected = selectedItem?.sha === item.sha;

                  return (
                    <li key={item.sha}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
                          selected && 'bg-primary/10 text-foreground',
                        )}
                      >
                        {item.type === 'dir' ? (
                          <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectMode === 'dir' && (
            <p className="text-xs text-muted-foreground">
              Navigate to the target folder, then click "Select Current Folder".
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onHide}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectMode === 'file' && !selectedItem}>
            {selectMode === 'dir' ? 'Select Current Folder' : 'Select File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
