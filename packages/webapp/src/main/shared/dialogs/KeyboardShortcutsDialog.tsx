import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ShortcutEntry {
  keys: string;
  /** i18n key resolved with t() at render time. */
  description: string;
}

interface ShortcutCategory {
  /** i18n key resolved with t() at render time. */
  label: string;
  shortcuts: ShortcutEntry[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '\u2318' : 'Ctrl';

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    label: 'dialogs.shortcuts.category.general',
    shortcuts: [
      { keys: `${modKey}+K`, description: 'dialogs.shortcuts.action.commandPalette' },
      { keys: `${modKey}+Z`, description: 'dialogs.shortcuts.action.undo' },
      { keys: `${modKey}+Y`, description: 'dialogs.shortcuts.action.redo' },
      { keys: `${modKey}+Shift+Z`, description: 'dialogs.shortcuts.action.redoAlt' },
      { keys: 'Delete / Backspace', description: 'dialogs.shortcuts.action.deleteElement' },
      { keys: 'Arrow keys', description: 'dialogs.shortcuts.action.moveElement' },
      { keys: 'Escape', description: 'dialogs.shortcuts.action.closeDeselect' },
    ],
  },
  {
    label: 'dialogs.shortcuts.category.guiEditor',
    shortcuts: [
      { keys: `${modKey}+S`, description: 'dialogs.shortcuts.action.save' },
      { keys: `${modKey}+C`, description: 'dialogs.shortcuts.action.copyComponent' },
      { keys: `${modKey}+V`, description: 'dialogs.shortcuts.action.pasteComponent' },
      { keys: `${modKey}+D`, description: 'dialogs.shortcuts.action.duplicateComponent' },
      { keys: `${modKey}+P`, description: 'dialogs.shortcuts.action.togglePreview' },
      { keys: `${modKey}+E`, description: 'dialogs.shortcuts.action.exportTemplate' },
      { keys: `${modKey}+J`, description: 'dialogs.shortcuts.action.showJson' },
      { keys: 'Escape', description: 'dialogs.shortcuts.action.selectParent' },
    ],
  },
  {
    label: 'dialogs.shortcuts.category.quantumEditor',
    shortcuts: [
      { keys: `${modKey}+C`, description: 'dialogs.shortcuts.action.copyGate' },
      { keys: `${modKey}+V`, description: 'dialogs.shortcuts.action.pasteGate' },
    ],
  },
  {
    label: 'dialogs.shortcuts.category.help',
    shortcuts: [
      { keys: '?', description: 'dialogs.shortcuts.action.showShortcuts' },
      { keys: `${modKey}+/`, description: 'dialogs.shortcuts.action.showShortcuts' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Renders an individual key token inside a <kbd> element. */
const Key: React.FC<{ label: string }> = ({ label }) => (
  <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-brand/20 bg-brand/[0.06] px-1.5 py-0.5 font-mono text-xs font-medium text-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.04)]">
    {label}
  </kbd>
);

/** Splits a key combo string like "Ctrl+Shift+Z" into styled <kbd> tokens. */
const KeyCombo: React.FC<{ combo: string }> = ({ combo }) => {
  // Handle "Delete / Backspace" or "Arrow keys" style entries
  if (combo.includes(' / ')) {
    const parts = combo.split(' / ');
    return (
      <span className="flex flex-wrap items-center gap-1">
        {parts.map((part, i) => (
          <React.Fragment key={part}>
            {i > 0 && <span className="text-muted-foreground/60">/</span>}
            <Key label={part.trim()} />
          </React.Fragment>
        ))}
      </span>
    );
  }

  const tokens = combo.split('+');
  return (
    <span className="flex items-center gap-0.5">
      {tokens.map((token, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground/50">+</span>}
          <Key label={token} />
        </React.Fragment>
      ))}
    </span>
  );
};

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[560px] max-w-[92vw] overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5 text-brand" />
            {t('dialogs.shortcuts.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.shortcuts.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 pb-6 pt-2">
          <div className="flex flex-col gap-5">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {t(category.label)}
                </h3>
                <div className="flex flex-col rounded-lg border border-border/70">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div
                      key={shortcut.description + shortcut.keys}
                      className={`flex items-center justify-between px-3 py-2 ${
                        idx !== category.shortcuts.length - 1 ? 'border-b border-border/50' : ''
                      }`}
                    >
                      <span className="text-sm text-foreground/90">{t(shortcut.description)}</span>
                      <KeyCombo combo={shortcut.keys} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Hook that registers global keyboard listeners to open the shortcuts dialog.
 * Listens for `?` (unmodified) and `Ctrl+/` (`Cmd+/` on macOS).
 */
export function useKeyboardShortcutsToggle(onOpen: () => void) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs / textareas / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // "?" key (Shift+/ on US layout, or just ? on others)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onOpen();
        return;
      }

      // Ctrl+/ or Cmd+/
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        onOpen();
      }
    },
    [onOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
