/**
 * Over the canvas while the model BESSER read from a repo's code awaits review:
 * where it came from, and Accept or Discard. Discarding keeps the project and
 * its link, so the agent can still work on the repo's code.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, FileCode2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { setProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import { useRepoSync } from '../hooks/useRepoSync';

export const ModelProposalBanner: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const { currentProject, loadProject } = useProject();
  const { link } = useRepoSync();
  const proposal = link?.modelProposal;
  if (!link || !proposal || !currentProject) return null;

  const settle = () => {
    const { modelProposal: _done, ...rest } = link;
    setProjectGitHubLink(currentProject.id, rest);
  };

  const discard = async () => {
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    const index = project?.currentDiagramIndices?.ClassDiagram ?? 0;
    const diagram = project?.diagrams.ClassDiagram?.[index];
    if (project && diagram?.model) {
      diagram.model = { ...diagram.model, elements: {}, relationships: {} } as typeof diagram.model;
      ProjectStorageRepository.saveProject(project);
    }
    settle();
    await loadProject(currentProject.id);
  };

  const files = proposal.source_files;
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
          {t('github.proposal.title', {
            defaultValue: 'Proposed from {{repo}}: {{count}} classes',
            repo: `${link.owner}/${link.repo}`,
            count: proposal.entities.length,
          })}
        </p>
        <p className="text-xs text-muted-foreground" title={files.join(', ')}>
          {t('github.proposal.source', {
            defaultValue: 'Read from its {{source}} in {{files}}. Edit anything, then accept.',
            source: proposal.model_source ?? '',
            files: files.slice(0, 2).join(', ') + (files.length > 2 ? ', …' : ''),
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
