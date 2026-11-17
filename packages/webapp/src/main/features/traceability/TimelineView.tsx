import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertTriangle, Bot, ChevronDown, ChevronRight, Code2, ListChecks, MessagesSquare, Pencil, Wand2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  CodeArtifact,
  ModelArtifact,
  RequirementArtifact,
  TraceChangeEvent,
  TraceOperation,
} from '../../shared/types/traceability';
import { changesOf, isCodeArtifact, isModelArtifact, isRequirementArtifact, logsOf } from '../../shared/types/traceability';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { diagramOf, diagramsOfOperation, isDiagram, topLevelOf } from '../../shared/traceability/traceQueries';
import type { OperationKind } from './traceLabels';
import {
  actorNames, byAgent, derivedBy, describeChange, elementTypeLabel, formatTime, operationKind, operationLabel, requirementLabel,
  statusLabel,
} from './traceLabels';
import { FilterPills } from './components/FilterPills';
import { toggledIn } from './components/toggleSet';
import { TypeTag } from './components/TypeTag';

const OPERATION_ICONS: Record<OperationKind, React.ReactNode> = {
  modeling: <Pencil className="size-4" />,
  generation: <Code2 className="size-4" />,
  extraction: <ListChecks className="size-4" />,
  conversation: <MessagesSquare className="size-4" />,
};

const FILTERS: Array<OperationKind | 'all'> = ['all', 'modeling', 'generation', 'extraction', 'conversation'];
const ALL_ACTORS = '__all_actors__';
/** Operations shown at first, and added by each "Show more": a long history renders a page at a time. */
export const TIMELINE_PAGE_SIZE = 50;

/** What the Timeline's search looks in: an operation's label, its changes, its messages, the requirements and
 *  files it wrote, and the diagrams it worked on. Lower-cased, built once per trace. */
export function operationSearchText(t: TFunction, operation: TraceOperation, index: TraceIndex): string {
  const parts = [operationLabel(t, operation, index), actorNames(operation, index, t)];
  for (const change of changesOf(operation)) parts.push(describeChange(t, change, index));
  for (const log of logsOf(operation)) parts.push(log.content);
  for (const id of operation.writes) {
    const artifact = index.artifacts.get(id);
    if (isRequirementArtifact(artifact)) parts.push(artifact.name, artifact.quote);
    else if (isCodeArtifact(artifact)) parts.push(artifact.path);
    else if (artifact) parts.push(artifact.name);
  }
  for (const diagram of diagramsOfOperation(index, operation)) parts.push(diagram.name);
  return parts.join('\n').toLowerCase();
}

/** The start of a local calendar day (`yyyy-mm-dd`), in ms; the day after it with `endOfDay`. */
const dayStart = (day: string, endOfDay = false): number => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + (endOfDay ? 1 : 0)).getTime();
};

interface TimelineViewProps {
  index: TraceIndex;
  onOpenElement: (artifactId: string) => void;
}

/** Operations, newest first, each expandable to its changes grouped by element. */
export const TimelineView: React.FC<TimelineViewProps> = ({ index, onOpenElement }) => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<OperationKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState(ALL_ACTORS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(TIMELINE_PAGE_SIZE);
  const needle = useDeferredValue(query.trim().toLowerCase());
  useEffect(() => setShown(TIMELINE_PAGE_SIZE), [filter, needle, actor, from, to]);

  const searchText = useMemo(
    () => new Map(index.trace.operations.map((op) => [op.id, operationSearchText(t, op, index)])),
    [index, t],
  );
  // Actors who did something, by name.
  const actors = useMemo(() => {
    const active = new Set(index.trace.operations.flatMap((op) => op.performedBy));
    return index.trace.actors.filter((a) => active.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [index]);

  // Newest first. Operations that start together (a conversation and the extraction of its first
  // request) are shown in reverse order of recording: the later one is the more recent step.
  const operations = useMemo(() => {
    const recorded = new Map(index.trace.operations.map((op, position) => [op.id, position]));
    const after = from ? dayStart(from) : -Infinity;
    const before = to ? dayStart(to, true) : Infinity;
    return index.trace.operations
      .filter((op) => filter === 'all' || operationKind(op) === filter)
      .filter((op) => actor === ALL_ACTORS || op.performedBy.includes(actor))
      .filter((op) => {
        if (!from && !to) return true;
        const time = new Date(op.startedAt).getTime();
        return time >= after && time < before;
      })
      .filter((op) => !needle || searchText.get(op.id)!.includes(needle))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || recorded.get(b.id)! - recorded.get(a.id)!);
  }, [index, filter, needle, actor, from, to, searchText]);

  const filtered = filter !== 'all' || query !== '' || actor !== ALL_ACTORS || from !== '' || to !== '';
  const clear = () => {
    setFilter('all');
    setQuery('');
    setActor(ALL_ACTORS);
    setFrom('');
    setTo('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills
            values={FILTERS}
            value={filter}
            onChange={setFilter}
            label={(value) => t(`traceability.timeline.filters.${value}`)}
            groupLabel={t('traceability.timeline.kindFilter')}
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('traceability.timeline.search')}
            aria-label={t('traceability.timeline.search')}
            className="h-8 w-full sm:ml-auto sm:w-72"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label={t('traceability.timeline.actor')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACTORS}>{t('traceability.timeline.allActors')}</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {a.type === 'Agent' && <span className="ml-1 text-muted-foreground">({t('traceability.timeline.agent')})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5">
            {t('traceability.timeline.from')}
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
          </label>
          <label className="flex items-center gap-1.5">
            {t('traceability.timeline.to')}
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 w-36 text-xs" />
          </label>
          {filtered && (
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clear}>
              <X className="size-3.5" />
              {t('traceability.timeline.clearFilters')}
            </Button>
          )}
          {filtered && (
            <span className="ml-auto tabular-nums" aria-live="polite">
              {t('traceability.timeline.matching', { shown: operations.length, total: index.trace.operations.length })}
            </span>
          )}
        </div>
      </div>

      {operations.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.timeline.empty')}</p>}

      <ol className="relative ml-3 space-y-2 border-l border-border pl-5">
        {operations.slice(0, shown).map((op) => (
          <li key={op.id} className="relative">
            <span
              className={cn(
                'absolute -left-[33px] top-2 flex size-7 items-center justify-center rounded-full border bg-background',
                op.status !== 'SUCCEEDED'
                  ? 'border-destructive/40 text-destructive'
                  : operationKind(op) === 'generation'
                    ? 'border-brand/30 bg-brand/10 text-brand-dark dark:text-brand-light'
                    : 'border-border text-muted-foreground',
              )}
              aria-hidden
            >
              {derivedBy(op, index) ? (
                <Wand2 className="size-4" />
              ) : op.type === 'ModelingSession' && byAgent(op, index) ? (
                <Bot className="size-4" />
              ) : (
                OPERATION_ICONS[operationKind(op)]
              )}
            </span>
            <OperationCard
              operation={op}
              index={index}
              open={expanded.has(op.id)}
              onToggle={() => setExpanded((previous) => toggledIn(previous, op.id))}
              onOpenElement={onOpenElement}
              locale={i18n.language}
            />
          </li>
        ))}
      </ol>
      {operations.length > shown && (
        <button
          type="button"
          onClick={() => setShown((count) => count + TIMELINE_PAGE_SIZE)}
          className="ml-8 text-sm text-brand-dark hover:underline dark:text-brand-light"
        >
          {t('traceability.timeline.showMore', { count: Math.min(TIMELINE_PAGE_SIZE, operations.length - shown), total: operations.length - shown })}
        </button>
      )}
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
  const linkCount = isGeneration ? (index.linksByOperation.get(operation.id)?.length ?? 0) : 0;
  const requirements = useMemo(
    () => operation.writes.map((id) => index.artifacts.get(id)).filter(isRequirementArtifact),
    [index, operation],
  );
  const diagrams = useMemo(() => diagramsOfOperation(index, operation), [index, operation]);
  const generator = derivedBy(operation, index);
  // The models a generator run read, which what it made is derived from (a GUI from its class diagram).
  const derivedFrom = useMemo(() => {
    if (!generator) return [];
    const changed = new Set(changesOf(operation).map((c) => index.artifacts.get(c.artifactId)).flatMap((a) => (a ? [diagramOf(index, a)?.id] : [])));
    return diagrams.filter((diagram) => !changed.has(diagram.id));
  }, [generator, operation, index, diagrams]);

  // Changes grouped under the element they belong to (a class and its attributes together).
  const groups = useMemo(() => {
    const byElement = new Map<string, TraceChangeEvent[]>();
    for (const change of changesOf(operation)) {
      const artifact = index.artifacts.get(change.artifactId);
      const key = artifact ? topLevelOf(index, artifact).id : change.artifactId;
      byElement.set(key, [...(byElement.get(key) ?? []), change]);
    }
    return [...byElement.entries()];
  }, [operation, index]);
  const failed = operation.status !== 'SUCCEEDED';

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : <ChevronRight className="size-4 shrink-0" aria-hidden />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{operationLabel(t, operation, index)}</span>
            {failed && (
              <Badge variant="destructive" size="sm">
                <AlertTriangle className="mr-1 size-3" aria-hidden />
                {statusLabel(t, operation.status)}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {actorNames(operation, index, t)} · {formatTime(operation.startedAt, locale)}
            {operation.endedAt && operation.endedAt !== operation.startedAt && ` – ${formatTime(operation.endedAt, locale)}`}
          </div>
        </div>
        <Badge variant="secondary" size="sm" className="shrink-0">
          {isGeneration
            ? t('traceability.timeline.linkCount', { count: linkCount })
            : operation.type === 'RequirementExtraction'
              ? t('traceability.timeline.requirementCount', { count: requirements.length })
            : operation.type === 'Conversation'
              ? t('traceability.timeline.messageCount', { count: logsOf(operation).length })
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
              className="rounded border border-border px-1.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {diagram.name}
              <TypeTag className="ml-1.5">{elementTypeLabel(t, diagram.elementType)}</TypeTag>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
          {isGeneration ? (
            <GenerationSummary operation={operation} index={index} onOpenElement={onOpenElement} />
          ) : operation.type === 'RequirementExtraction' ? (
            <RequirementList requirements={requirements} />
          ) : operation.type === 'Conversation' ? (
            <ol className="space-y-1.5">
              {logsOf(operation).map((log) => (
                <li key={log.id} className="text-sm">
                  <span className="mr-2 text-[10px] font-medium uppercase text-muted-foreground">
                    {t(`traceability.timeline.logTypes.${log.logType}`, { defaultValue: log.logType })}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{log.content}</span>
                </li>
              ))}
            </ol>
          ) : (
            <>
              {generator && (
                <p className="text-xs text-muted-foreground">
                  {t('traceability.timeline.derivedBy', {
                    generator: generator.name,
                    models: derivedFrom.map((d) => d.name).join(', ') || t('traceability.timeline.unknownModels'),
                  })}
                </p>
              )}
              {groups.map(([elementId, changes]) => (
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
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** The requirements an extraction wrote, each with its kind. */
const RequirementList: React.FC<{ requirements: RequirementArtifact[] }> = ({ requirements }) => {
  const { t } = useTranslation();
  return (
    <ol className="space-y-1">
      {requirements.map((requirement) => (
        <li key={requirement.id} className="text-sm">
          <Badge variant="outline" size="sm" className="mr-2">
            {requirementLabel(t, requirement.kind)}
          </Badge>
          {requirement.name}
        </li>
      ))}
    </ol>
  );
};

const GenerationSummary: React.FC<{ operation: TraceOperation; index: TraceIndex; onOpenElement: (id: string) => void }> = ({
  operation,
  index,
  onOpenElement,
}) => {
  const { t } = useTranslation();
  const sources = useMemo(() => {
    const ids = new Set((index.linksByOperation.get(operation.id) ?? []).map((l) => l.sourceId));
    return [...ids]
      .map((id) => index.artifacts.get(id))
      .filter((a): a is ModelArtifact => isModelArtifact(a) && !isDiagram(a));
  }, [index, operation]);
  const files = operation.writes
    .map((id) => index.artifacts.get(id))
    .filter((a): a is CodeArtifact => isCodeArtifact(a) && a.startLine === undefined);
  const compacted = sources.length === 0 && files.length > 0;
  return (
    <div className="space-y-2">
      {compacted && <p className="text-xs text-muted-foreground">{t('traceability.timeline.compacted')}</p>}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-muted-foreground">{t('traceability.timeline.files')}:</span>
        {files.map((f) => (
          <code key={f.id} className="rounded bg-muted px-1 py-0.5 text-xs">{f.path}</code>
        ))}
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">{t('traceability.timeline.tracedElements')}:</span>
          {sources.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpenElement(a.id)}
              className="rounded border border-border px-1.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
