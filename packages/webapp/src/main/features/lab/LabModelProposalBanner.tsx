/**
 * Over the canvas while the open class diagram is a model the lab agent proposes for
 * its change: Keep makes it an ordinary diagram, Discard closes it.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FlaskConical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppSelector } from '../../app/store/hooks';
import { selectActiveDiagram, selectActiveDiagramType } from '../../app/store/workspaceSlice';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { reportError } from '../../shared/services/errors/reportError';
import { discardLabProposal, keepLabProposal, labProposalChangeId } from './labDone';

export const LabModelProposalBanner: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const activeType = useAppSelector(selectActiveDiagramType);
  const diagram = useAppSelector(selectActiveDiagram);
  const [busy, setBusy] = useState(false);
  if (activeType !== 'ClassDiagram' || !diagram || labProposalChangeId(diagram) === null) return null;
  const diagramId = diagram.id;

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

  return (
    <div
      role="region"
      aria-label={t('lab.proposal.label', { defaultValue: 'Proposed model' })}
      className={cn(
        'pointer-events-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-background/95 px-4 py-2.5 text-sm shadow-elevation-2 backdrop-blur',
        className,
      )}
    >
      <FlaskConical className="size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {t('lab.proposal.title', { defaultValue: 'The agent proposes this model for the extension' })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('lab.proposal.hint', { defaultValue: 'Edit anything that is off, then keep it or discard it.' })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => void discard()}>
          <X className="size-3.5" />
          {t('lab.proposal.discard', { defaultValue: 'Discard' })}
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={busy}
          onClick={() => void settle(() => keepLabProposal(diagramId))}
        >
          <Check className="size-3.5" />
          {t('lab.proposal.keep', { defaultValue: 'Keep' })}
        </Button>
      </div>
    </div>
  );
};
