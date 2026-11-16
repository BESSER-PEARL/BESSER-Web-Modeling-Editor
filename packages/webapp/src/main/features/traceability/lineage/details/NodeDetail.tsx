import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, ArrowRight, Crosshair, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TraceArtifact } from '../../../../shared/types/traceability';
import { isCodeArtifact, isModelArtifact, isPromptArtifact, isRequirementArtifact } from '../../../../shared/types/traceability';
import type { TraceIndex } from '../../../../shared/traceability/traceQueries';
import { fragmentLines, historyOf } from '../../../../shared/traceability/traceQueries';
import type { Lineage } from '../../../../shared/traceability/lineage';
import { describeChange, formatTime } from '../../traceLabels';
import { CodeLines } from '../../components/CodeLines';
import { artifactKindLabel, nodeLabel } from '../lineageLabels';
import { DetailPane, DetailSection } from './DetailPane';

/** How many of a node's links its detail lists. */
const LISTED_LINKS = 20;
/** How many of a model element's latest edits its detail lists. */
const LISTED_CHANGES = 8;

/** A selected artifact: what it is, its content, its links and its latest edits. */
export const NodeDetail: React.FC<{
  index: TraceIndex;
  lineage: Lineage;
  artifact: TraceArtifact;
  isRoot: boolean;
  onFocus: (id: string) => void;
  onOpenElement: (id: string) => void;
  onSelectEdge: (linkId: string) => void;
}> = ({ index, lineage, artifact, isRoot, onFocus, onOpenElement, onSelectEdge }) => {
  const { t, i18n } = useTranslation();
  const history = isModelArtifact(artifact) ? historyOf(index, artifact.id) : [];
  const file = isCodeArtifact(artifact) && artifact.parentId ? index.artifacts.get(artifact.parentId) : artifact;
  const lines = isCodeArtifact(artifact) && isCodeArtifact(file) ? fragmentLines({ fragment: artifact, file }) : null;
  const outdated = lineage.nodes.get(artifact.id)?.outOfDate ?? false;
  const links = lineage.edges.filter((e) => e.link.sourceId === artifact.id || e.link.targetId === artifact.id);
  return (
    <DetailPane>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{nodeLabel(t, index, artifact)}</h3>
        <Badge variant="soft" size="sm">{artifactKindLabel(t, artifact)}</Badge>
        {outdated && (
          <Badge variant="destructive" size="sm">
            <AlertTriangle className="mr-1 size-3" aria-hidden />
            {t('traceability.status.outOfDate')}
          </Badge>
        )}
      </div>
      {isCodeArtifact(artifact) && <code className="block truncate text-xs text-muted-foreground">{artifact.path}</code>}
      {isPromptArtifact(artifact) && (
        <blockquote className="max-h-48 overflow-auto whitespace-pre-wrap border-l-2 border-border pl-2 text-xs">{artifact.content}</blockquote>
      )}
      {isRequirementArtifact(artifact) && (
        <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-2 text-xs">{artifact.quote}</blockquote>
      )}
      <div className="flex flex-wrap gap-2">
        {!isRoot && (
          <Button size="sm" variant="outline" onClick={() => onFocus(artifact.id)}>
            <Crosshair className="mr-1 size-3.5" />
            {t('traceability.lineage.focus')}
          </Button>
        )}
        {isModelArtifact(artifact) && (
          <Button size="sm" variant="outline" onClick={() => onOpenElement(artifact.id)}>
            <ExternalLink className="mr-1 size-3.5" />
            {t('traceability.lineage.openInElements')}
          </Button>
        )}
      </div>
      {lines && (
        <div className="overflow-hidden rounded border border-border">
          <CodeLines lines={lines} firstLine={isCodeArtifact(artifact) ? artifact.startLine ?? 1 : 1} className="max-h-64" />
        </div>
      )}
      <DetailSection title={t('traceability.lineage.links', { count: links.length })}>
        {links.length === 0 && <p className="text-xs text-muted-foreground">{t('traceability.lineage.noLinks')}</p>}
        <ul className="space-y-0.5 text-xs">
          {links.slice(0, LISTED_LINKS).map(({ link, outOfDate }) => {
            const outgoing = link.sourceId === artifact.id;
            const other = index.artifacts.get(outgoing ? link.targetId : link.sourceId)!;
            const Arrow = outgoing ? ArrowRight : ArrowLeft;
            return (
              <li key={link.id}>
                <button
                  type="button"
                  onClick={() => onSelectEdge(link.id)}
                  className="flex w-full items-center gap-1 rounded px-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Arrow className="size-3 shrink-0 text-muted-foreground" role="img" aria-label={t(outgoing ? 'traceability.lineage.derivedTo' : 'traceability.lineage.derivedFrom')} />
                  <span className="truncate">{nodeLabel(t, index, other)}</span>
                  {isCodeArtifact(other) && other.parentId && <span className="truncate text-muted-foreground">{other.path}</span>}
                  {outOfDate.length > 0 && (
                    <AlertTriangle className="ml-auto size-3 shrink-0 text-amber-500" role="img" aria-label={t('traceability.status.outOfDate')} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {links.length > LISTED_LINKS && (
          <p className="text-xs text-muted-foreground">{t('traceability.lineage.moreLinks', { count: links.length - LISTED_LINKS })}</p>
        )}
      </DetailSection>
      {isModelArtifact(artifact) && (
        <DetailSection title={t('traceability.elements.history')}>
          {history.length === 0 && <p className="text-xs text-muted-foreground">{t('traceability.elements.noHistory')}</p>}
          <ol className="space-y-0.5 text-xs">
            {[...history].reverse().slice(0, LISTED_CHANGES).map(({ change }) => (
              <li key={change.id}>
                {describeChange(t, change, index)}
                <span className="ml-1 text-muted-foreground">{formatTime(change.timestamp, i18n.language)}</span>
              </li>
            ))}
          </ol>
        </DetailSection>
      )}
    </DetailPane>
  );
};
