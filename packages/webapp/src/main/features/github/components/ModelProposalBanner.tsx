/**
 * Over the canvas while the model BESSER read from a repo's code awaits review:
 * where it came from, and Accept or Discard. Discarding keeps the project and
 * its link, so the agent can still work on the repo's code.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FileCode2, X } from 'lucide-react';
import { UMLDiagramType } from '@besser/wme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { setProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import { createEmptyDiagram } from '../../../shared/types/project';
import { useRepoSync } from '../hooks/useRepoSync';

export const ModelProposalBanner: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const { currentProject, loadProject } = useProject();
  const { link } = useRepoSync({ checkRemote: false });
  const proposal = link?.modelProposal;
  if (!link || !proposal || !currentProject) return null;

  const settle = () => {
    const { modelProposal: _done, ...rest } = link;
    setProjectGitHubLink(currentProject.id, rest);
  };

  const discard = async () => {
    const confirmed = await globalConfirm({
      title: t('github.proposal.discardConfirmTitle', { defaultValue: 'Discard the proposed model?' }),
      description: t('github.proposal.discardConfirmDescription', {
        defaultValue: 'The classes BESSER read from the code are removed from the canvas. The repository and its code stay as they are.',
      }),
      confirmLabel: t('github.proposal.discard', { defaultValue: 'Discard' }),
      variant: 'danger',
    });
    if (!confirmed) return;
    // Only the diagram that holds the proposal is emptied, never the user's
    // own; a proposal recorded without its diagram just stops being one.
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    const diagram = proposal.diagramId
      ? project?.diagrams.ClassDiagram?.find((candidate) => candidate.id === proposal.diagramId)
      : undefined;
    if (project && diagram?.model) {
      diagram.model = createEmptyDiagram(diagram.title, UMLDiagramType.ClassDiagram).model;
      ProjectStorageRepository.saveProject(project);
    }
    settle();
    await loadProject(currentProject.id);
  };

  const files = proposal.source_files;
  const shownFiles = files.slice(0, 2).join(', ') + (files.length > 2 ? ', …' : '');
  return (
    <div
      role="region"
      aria-label={t('github.proposal.label', { defaultValue: 'Proposed model' })}
      className={cn(
        'pointer-events-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-background/95 px-4 py-2.5 text-sm shadow-elevation-2 backdrop-blur',
        className,
      )}
    >
      <FileCode2 className="size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {proposal.ai
            ? t('github.proposal.aiTitle', {
                defaultValue: 'Proposed by AI from {{repo}}: {{count}} classes',
                repo: `${link.owner}/${link.repo}`,
                count: proposal.entities.length,
              })
            : t('github.proposal.title', {
                defaultValue: 'Proposed from {{repo}}: {{count}} classes',
                repo: `${link.owner}/${link.repo}`,
                count: proposal.entities.length,
              })}
        </p>
        <p className="text-xs text-muted-foreground" title={files.join(', ')}>
          {proposal.ai
            ? t('github.proposal.aiSource', {
                defaultValue: 'An AI reading of {{files}}, not an exact one. Check each class, then accept.',
                files: shownFiles,
              })
            : t('github.proposal.source', {
                defaultValue: 'Read from its {{source}} in {{files}}. Edit anything, then accept.',
                source: proposal.model_source ?? '',
                files: shownFiles,
              })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void discard()}>
          <X className="size-3.5" />
          {t('github.proposal.discard', { defaultValue: 'Discard' })}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={settle}>
          <Check className="size-3.5" />
          {t('github.proposal.accept', { defaultValue: 'Accept model' })}
        </Button>
      </div>
    </div>
  );
};
