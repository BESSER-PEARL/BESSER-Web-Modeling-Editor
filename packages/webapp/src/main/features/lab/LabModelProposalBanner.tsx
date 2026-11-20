/**
 * Above the canvas while the open class diagram is a model the lab agent proposes for
 * its change: Keep makes it an ordinary diagram, Discard closes it. When the agent
 * revised the proposal while the user was editing it, the banner offers the revision
 * instead: replace the user's version with it, or keep the user's version.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FlaskConical, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppSelector } from '../../app/store/hooks';
import { selectActiveDiagram, selectActiveDiagramType } from '../../app/store/workspaceSlice';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { reportError } from '../../shared/services/errors/reportError';
import {
  applyLabRevision,
  discardLabProposal,
  dismissLabRevision,
  keepLabProposal,
  labProposalChangeId,
  labRevisionOf,
} from './labDone';

export const LabModelProposalBanner: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const activeType = useAppSelector(selectActiveDiagramType);
  const diagram = useAppSelector(selectActiveDiagram);
  const [busy, setBusy] = useState(false);
  if (activeType !== 'ClassDiagram' || !diagram || labProposalChangeId(diagram) === null) return null;
  const diagramId = diagram.id;
  const revised = labRevisionOf(diagram) !== null;

  const settle = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error('[lab] could not settle the proposed model:', error);
      reportError(t('lab.proposal.errors.settleFailed', { defaultValue: 'The proposed model could not be updated.' }), {
        error,
      });
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    const confirmed = await globalConfirm({
      title: t('lab.proposal.discardConfirmTitle', { defaultValue: 'Discard the proposed model?' }),
      description: t('lab.proposal.discardConfirmDescription', {
        defaultValue: 'The tab with the class diagram the lab agent proposed is closed. The change itself stays as it is.',
      }),
      confirmLabel: t('lab.proposal.discard', { defaultValue: 'Discard' }),
      variant: 'danger',
    });
    if (confirmed) await settle(() => discardLabProposal(diagramId));
  };

  const title = revised
    ? t('lab.proposal.revisedTitle', { defaultValue: 'The agent revised its proposal while you were editing' })
    : t('lab.proposal.title', { defaultValue: 'The agent proposes this model for the extension' });
  const hint = revised
    ? t('lab.proposal.revisedHint', { defaultValue: 'Your version is on the canvas. Replace it with the revision or keep yours.' })
    : t('lab.proposal.hint', { defaultValue: 'Edit anything that is off, then keep it or discard it.' });

  // One compact row, so the canvas under it loses as little room as it can.
  return (
    <div
      role="region"
      aria-label={t('lab.proposal.label', { defaultValue: 'Proposed model' })}
      className={cn(
        'pointer-events-auto flex max-w-3xl items-center gap-2.5 rounded-lg border border-brand/30 bg-background/95 py-1 pl-3 pr-1 text-xs shadow-elevation-1 backdrop-blur',
        className,
      )}
    >
      <FlaskConical className="size-3.5 shrink-0 text-brand" aria-hidden />
      <p className="min-w-0 flex-1 truncate" title={`${title}. ${hint}`}>
        <span className="font-medium">{title}</span>
        <span className="ml-2 text-muted-foreground">{hint}</span>
      </p>
      <div className="flex shrink-0 gap-1">
        {revised ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              disabled={busy}
              onClick={() => void settle(() => dismissLabRevision(diagramId))}
            >
              <Check className="size-3.5" />
              {t('lab.proposal.keepMine', { defaultValue: 'Keep mine' })}
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={busy}
              onClick={() => void settle(() => applyLabRevision(diagramId))}
            >
              <RefreshCw className="size-3.5" />
              {t('lab.proposal.useRevision', { defaultValue: 'Use the revision' })}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={busy} onClick={() => void discard()}>
              <X className="size-3.5" />
              {t('lab.proposal.discard', { defaultValue: 'Discard' })}
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={busy}
              onClick={() => void settle(() => keepLabProposal(diagramId))}
            >
              <Check className="size-3.5" />
              {t('lab.proposal.keep', { defaultValue: 'Keep' })}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
