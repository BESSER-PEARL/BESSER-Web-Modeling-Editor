/** The card shown when someone else's commits reach the linked branch: who, what, and how to take them in. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authorColor } from './ModelAttributionLayer';

export interface TeammateChange {
  author: string;
  subject: string;
  /** Saved from the editor, so it changed the model; anything else may only have touched code. */
  changedModel: boolean;
  moreCommits: number;
}

export type TeammateChangeAction = 'getLatest' | 'save' | 'preview';

interface TeammateChangeNoticeProps {
  change: TeammateChange;
  repoName: string;
  branch: string;
  hasLocalChanges: boolean;
  onAction: (action: TeammateChangeAction) => void;
  /** Given by the toast that renders this card. */
  closeToast?: () => void;
}

export const TeammateChangeNotice: React.FC<TeammateChangeNoticeProps> = ({
  change,
  repoName,
  branch,
  hasLocalChanges,
  onAction,
  closeToast,
}) => {
  const { t } = useTranslation();
  const { author, subject, changedModel, moreCommits } = change;

  const act = (action: TeammateChangeAction) => {
    closeToast?.();
    onAction(action);
  };

  return (
    <div className="flex gap-3 p-3.5 text-left">
      <span
        aria-hidden
        className="flex size-8 shrink-0 select-none items-center justify-center rounded-full text-sm font-semibold uppercase text-white"
        style={{ backgroundColor: authorColor(author) }}
      >
        {author.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-foreground">
            {changedModel
              ? t('github.teammate.changedModel', { defaultValue: '{{author}} changed the model', author })
              : t('github.teammate.pushed', { defaultValue: '{{author}} pushed to {{branch}}', author, branch })}
          </p>
          <button
            type="button"
            onClick={closeToast}
            aria-label={t('github.teammate.dismiss', { defaultValue: 'Dismiss' })}
            className="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <p className="mt-0.5 truncate text-sm leading-5 text-foreground/80" title={subject}>
          {subject}
        </p>
        <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
          {moreCommits > 0 && (
            <>
              {t('github.teammate.more', { defaultValue: 'and {{count}} more commits', count: moreCommits })}
              {' · '}
            </>
          )}
          {repoName}
        </p>
        {hasLocalChanges && (
          <p className="mt-2 text-xs leading-4 text-muted-foreground">
            {t('github.teammate.mergeHint', { defaultValue: 'You have unsaved edits. Saving merges both versions.' })}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1.5">
          <Button size="sm" className="h-8" onClick={() => act(hasLocalChanges ? 'save' : 'getLatest')}>
            {hasLocalChanges
              ? t('github.teammate.saveAndMerge', { defaultValue: 'Save and merge' })
              : t('github.menu.getLatest', { defaultValue: 'Get latest' })}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => act('preview')}>
            {t('github.preview.button', { defaultValue: 'Preview' })}
          </Button>
        </div>
      </div>
    </div>
  );
};
