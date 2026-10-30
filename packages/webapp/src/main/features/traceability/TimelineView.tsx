import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronDown, ChevronRight, Code2, MessagesSquare, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type {
  CodeArtifact,
  ModelArtifact,
  TraceChange,
  TraceOperation,
} from '../../shared/types/traceability';
import { changesOf, isCodeArtifact, isModelArtifact } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { diagramsOfOperation, isDiagram, topLevelOf } from '../../shared/traceability/traceQueries';
import type { OperationKind } from './traceLabels';
import { actorNames, byAgent, describeChange, elementTypeLabel, formatTime, operationKind, operationLabel } from './traceLabels';

const OPERATION_ICONS: Record<OperationKind, React.ReactNode> = {
  modeling: <Pencil className="size-4" />,
  generation: <Code2 className="size-4" />,
  conversation: <MessagesSquare className="size-4" />,
};

const FILTERS: Array<OperationKind | 'all'> = ['all', 'modeling', 'generation', 'conversation'];

interface TimelineViewProps {
  index: TraceIndex;
  onOpenElement: (artifactId: string) => void;
}

/** Operations, newest first, each expandable to its changes grouped by element. */
export const TimelineView: React.FC<TimelineViewProps> = ({ index, onOpenElement }) => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<OperationKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const operations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...index.trace.operations]
      .filter((op) => filter === 'all' || operationKind(op) === filter)
      .filter((op) => !needle || changesOf(op).some((c) => describeChange(t, c, index).toLowerCase().includes(needle)))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [index, filter, query, t]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === value ? 'border-brand bg-brand/10 text-brand-dark dark:text-brand-light' : 'border-input hover:bg-accent'
            }`}
          >
            {t(`traceability.timeline.filters.${value}`)}
          </button>
        ))}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('traceability.timeline.search')}
          className="ml-auto h-8 w-56"
        />
      </div>

      {operations.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.timeline.empty')}</p>}

      <ol className="relative space-y-2 border-l border-border pl-5">
        {operations.map((op) => (
          <li key={op.id} className="relative">
            <span className="absolute -left-[29px] top-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
              {op.type === 'Modeling' && byAgent(op, index) ? <Bot className="size-4" /> : OPERATION_ICONS[operationKind(op)]}
            </span>
            <OperationCard
              operation={op}
              index={index}
              open={expanded.has(op.id)}
              onToggle={() => toggle(op.id)}
              onOpenElement={onOpenElement}
              locale={i18n.language}
            />
          </li>
        ))}
      </ol>
    </div>
  );
};

interface OperationCardProps {
  operation: TraceOperation;
  index: TraceIndex;
  open: boolean;
  onToggle: () => void;
  onOpenElement: (artifactId: string) => void;
  locale: string;
}

const OperationCard: React.FC<OperationCardProps> = ({ operation, index, open, onToggle, onOpenElement, locale }) => {
  const { t } = useTranslation();
  const isGeneration = operation.type === 'CodeGeneration';
  const linkCount = isGeneration ? index.trace.traceLinks.filter((l) => l.operationId === operation.id).length : 0;
  const diagrams = useMemo(() => diagramsOfOperation(index, operation), [index, operation]);

  // Changes grouped under the element they belong to (a class and its attributes together).
  const groups = useMemo(() => {
    const byElement = new Map<string, TraceChange[]>();
    for (const change of changesOf(operation)) {
      const artifact = index.artifacts.get(change.artifactId);
      const key = artifact ? topLevelOf(index, artifact).id : change.artifactId;
      byElement.set(key, [...(byElement.get(key) ?? []), change]);
    }
    return [...byElement.entries()];
  }, [operation, index]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{operationLabel(t, operation, index)}</span>
            {operation.status !== 'SUCCEEDED' && <Badge variant="destructive" size="sm">{operation.status}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">
            {actorNames(operation, index)} · {formatTime(operation.startedAt, locale)}
            {operation.endedAt && operation.endedAt !== operation.startedAt && ` – ${formatTime(operation.endedAt, locale)}`}
          </div>
        </div>
        <Badge variant="secondary" size="sm">
          {isGeneration
            ? t('traceability.timeline.linkCount', { count: linkCount })
            : operation.type === 'Conversation'
              ? t('traceability.timeline.messageCount', { count: operation.logs.length })
              : t('traceability.timeline.changeCount', { count: changesOf(operation).length })}
        </Badge>
      </button>
      {diagrams.length > 0 && (
        <div className="-mt-1 flex flex-wrap items-center gap-1 pb-2 pl-10 pr-3">
          <span className="text-xs text-muted-foreground">{t('traceability.timeline.models')}:</span>
          {diagrams.map((diagram) => (
            <button
              key={diagram.id}
              type="button"
              onClick={() => onOpenElement(diagram.id)}
              className="rounded border border-border px-1.5 text-xs hover:bg-accent"
            >
              {diagram.name}
              <span className="ml-1 text-[10px] uppercase text-muted-foreground">{elementTypeLabel(t, diagram.elementType)}</span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
          {isGeneration ? (
            <GenerationSummary operation={operation} index={index} onOpenElement={onOpenElement} />
          ) : operation.type === 'Conversation' ? (
            <ol className="space-y-1">
              {operation.logs.map((log) => (
                <li key={log.id} className="text-sm">
                  <span className="mr-2 text-[10px] uppercase text-muted-foreground">
                    {t(`traceability.timeline.logTypes.${log.logType}`, { defaultValue: log.logType })}
                  </span>
                  {log.content}
                </li>
              ))}
            </ol>
          ) : (
            groups.map(([elementId, changes]) => (
              <div key={elementId}>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-dark hover:underline dark:text-brand-light"
                  onClick={() => onOpenElement(elementId)}
                >
                  {index.artifacts.get(elementId)?.name ?? elementId}
                </button>
                <ul className="ml-3 list-disc space-y-0.5 pl-3">
                  {changes.map((change) => (
                    <li key={change.id}>
                      <span>{describeChange(t, change, index)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{formatTime(change.timestamp, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const GenerationSummary: React.FC<{ operation: TraceOperation; index: TraceIndex; onOpenElement: (id: string) => void }> = ({
  operation,
  index,
  onOpenElement,
}) => {
  const { t } = useTranslation();
  const sources = useMemo(() => {
    const ids = new Set(index.trace.traceLinks.filter((l) => l.operationId === operation.id).map((l) => l.sourceId));
    return [...ids]
      .map((id) => index.artifacts.get(id))
      .filter((a): a is ModelArtifact => isModelArtifact(a) && !isDiagram(a));
  }, [index, operation]);
  const files = operation.produces
    .map((id) => index.artifacts.get(id))
    .filter((a): a is CodeArtifact => isCodeArtifact(a) && a.startLine === undefined);
  const compacted = sources.length === 0 && files.length > 0;
  return (
    <div className="space-y-2">
      {compacted && <p className="text-xs text-muted-foreground">{t('traceability.timeline.compacted')}</p>}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-muted-foreground">{t('traceability.timeline.files')}:</span>
        {files.map((f) => (
          <code key={f.id} className="rounded bg-muted px-1 py-0.5 text-xs">{f.name}</code>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="text-xs text-muted-foreground">{t('traceability.timeline.tracedElements')}:</span>
        {sources.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpenElement(a.id)}
            className="rounded border border-border px-1.5 text-xs hover:bg-accent"
          >
            {a.name}
          </button>
        ))}
      </div>
    </div>
  );
};
