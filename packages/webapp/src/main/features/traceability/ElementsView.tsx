import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, GitFork } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { ModelArtifact } from '../../shared/types/traceability';
import { isModelArtifact } from '../../shared/types/traceability';
import type { TraceIndex, GeneratedFragment } from '../../shared/traceability/traceQueries';
import {
  diagramsOf,
  fragmentLines,
  generatedFrom,
  historyOf,
  isDeleted,
  isDiagram,
  modelChildren,
} from '../../shared/traceability/traceQueries';
import { actorNames, describeChange, elementTypeLabel, formatTime, operationLabel } from './traceLabels';

interface ElementsViewProps {
  index: TraceIndex;
  selectedId: string | null;
  onSelect: (artifactId: string) => void;
  onShowLineage: (artifactId: string) => void;
}

/** The project's diagrams as a tree of their elements on the left; the selection's history and generated code on the right. */
export const ElementsView: React.FC<ElementsViewProps> = ({ index, selectedId, onSelect, onShowLineage }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  // Nodes whose open state the user flipped: diagrams start open, everything else closed.
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const diagrams = useMemo(() => diagramsOf(index), [index]);
  const selected = (selectedId && index.artifacts.get(selectedId)) || null;
  const needle = query.trim().toLowerCase();

  // Open the ancestors of an element selected from another view, so it shows in the tree.
  useEffect(() => {
    const ancestors: ModelArtifact[] = [];
    let current = selectedId ? index.artifacts.get(selectedId) : undefined;
    while (current?.parentId) {
      current = index.artifacts.get(current.parentId);
      if (isModelArtifact(current)) ancestors.push(current);
    }
    if (ancestors.length === 0) return;
    setToggled((previous) => {
      const next = new Set(previous);
      for (const ancestor of ancestors) {
        if (isDiagram(ancestor)) next.delete(ancestor.id);
        else next.add(ancestor.id);
      }
      return next;
    });
  }, [selectedId, index]);

  const tree: TreeContext = {
    index,
    selectedId,
    onSelect,
    needle,
    isOpen: (artifact) => needle !== '' || isDiagram(artifact) !== toggled.has(artifact.id),
    toggle: (id) =>
      setToggled((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };

  return (
    <div className="grid min-h-[420px] gap-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('traceability.elements.search')} className="h-8" />
        {diagrams.length === 0 && <p className="text-sm text-muted-foreground">{t('traceability.elements.empty')}</p>}
        <ul role="tree" className="max-h-[60vh] space-y-0.5 overflow-y-auto">
          {diagrams.map((diagram) => (
            <TreeNode key={diagram.id} artifact={diagram} tree={tree} />
          ))}
        </ul>
      </div>
      {selected ? (
        <ElementDetail index={index} artifactId={selected.id} onShowLineage={onShowLineage} />
      ) : (
        <p className="self-center text-center text-sm text-muted-foreground">{t('traceability.elements.pick')}</p>
      )}
    </div>
  );
};

interface TreeContext {
  index: TraceIndex;
  selectedId: string | null;
  onSelect: (artifactId: string) => void;
  /** The lower-cased search text; empty when not searching. */
  needle: string;
  isOpen: (artifact: ModelArtifact) => boolean;
  toggle: (artifactId: string) => void;
}

/** Whether the artifact or one of its fragments matches the search. */
function matches(index: TraceIndex, artifact: ModelArtifact, needle: string): boolean {
  return (
    !needle ||
    artifact.name.toLowerCase().includes(needle) ||
    modelChildren(index, artifact.id).some((child) => matches(index, child, needle))
  );
}

const TreeNode: React.FC<{ artifact: ModelArtifact; tree: TreeContext }> = ({ artifact, tree }) => {
  const { t } = useTranslation();
  const { index, selectedId, onSelect, needle } = tree;
  if (!matches(index, artifact, needle)) return null;
  const children = modelChildren(index, artifact.id);
  const open = children.length > 0 && tree.isOpen(artifact);
  const diagram = isDiagram(artifact);
  const deleted = isDeleted(index, artifact.id);

  return (
    <li role="treeitem" aria-expanded={children.length > 0 ? open : undefined} aria-selected={artifact.id === selectedId}>
      <div
        className={`flex items-center gap-1 rounded-md pr-2 text-sm ${
          artifact.id === selectedId ? 'bg-brand/10 text-brand-dark dark:text-brand-light' : 'hover:bg-accent'
        }`}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => tree.toggle(artifact.id)}
            aria-label={t(open ? 'traceability.elements.collapse' : 'traceability.elements.expand', { name: artifact.name })}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(artifact.id)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left"
        >
          <span className={`truncate ${diagram ? 'font-semibold' : ''} ${deleted ? 'text-muted-foreground line-through' : ''}`}>
            {artifact.name}
          </span>
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{elementTypeLabel(t, artifact.elementType)}</span>
        </button>
      </div>
      {open && (
        <ul role="group" className="ml-2.5 space-y-0.5 border-l border-border/60 pl-1">
          {children.map((child) => (
            <TreeNode key={child.id} artifact={child} tree={tree} />
          ))}
        </ul>
      )}
    </li>
  );
};

const ElementDetail: React.FC<{ index: TraceIndex; artifactId: string; onShowLineage: (artifactId: string) => void }> = ({
  index,
  artifactId,
  onShowLineage,
}) => {
  const { t, i18n } = useTranslation();
  const artifact = index.artifacts.get(artifactId)!;
  const history = useMemo(() => historyOf(index, artifactId), [index, artifactId]);
  const generated = useMemo(() => generatedFrom(index, artifactId), [index, artifactId]);
  const latestRun = generated[0]?.link.operationId;
  const [showOlder, setShowOlder] = useState(false);
  const shown = showOlder ? generated : generated.filter((g) => g.link.operationId === latestRun);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{artifact.name}</h3>
        {artifact.type === 'ModelArtifact' && <Badge variant="soft">{elementTypeLabel(t, artifact.elementType)}</Badge>}
        {isDeleted(index, artifactId) && <Badge variant="destructive">{t('traceability.elements.deleted')}</Badge>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => onShowLineage(artifactId)}>
          <GitFork className="mr-1 size-3.5" />
          {t('traceability.lineage.show')}
        </Button>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">
          {t(isDiagram(artifact) ? 'traceability.elements.generatedFiles' : 'traceability.elements.generatedCode')}
        </h4>
        {generated.length === 0 && <p className="text-sm text-muted-foreground">{t('traceability.elements.noCode')}</p>}
        {shown.map((entry) => (
          <CodeFragment key={entry.link.id} entry={entry} index={index} locale={i18n.language} />
        ))}
        {generated.length > shown.length && (
          <button type="button" className="text-xs text-brand-dark hover:underline dark:text-brand-light" onClick={() => setShowOlder(true)}>
            {t('traceability.elements.showOlder', { count: generated.length - shown.length })}
          </button>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">{t('traceability.elements.history')}</h4>
        {history.length === 0 && <p className="text-sm text-muted-foreground">{t('traceability.elements.noHistory')}</p>}
        <ol className="space-y-1 text-sm">
          {[...history].reverse().map(({ change, operation }) => (
            <li key={change.id} className="flex flex-wrap items-baseline gap-x-2">
              <span>{describeChange(t, change, index)}</span>
              <span className="text-xs text-muted-foreground">
                {formatTime(change.timestamp, i18n.language)} · {operationLabel(t, operation, index)} · {actorNames(operation, index)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

const CodeFragment: React.FC<{ entry: GeneratedFragment; index: TraceIndex; locale: string }> = ({ entry, index, locale }) => {
  const { t } = useTranslation();
  const lines = fragmentLines(entry);
  const rule = entry.link.evidence.find((e) => e.type === 'RuleEvidence');
  // A whole file (the link of a diagram) can be long, so it starts folded.
  const wholeFile = entry.fragment.startLine === undefined;
  const [unfolded, setUnfolded] = useState(!wholeFile);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-2 bg-muted/60 px-3 py-1.5 text-xs">
        <code className="font-medium">
          {wholeFile ? entry.fragment.path : `${entry.fragment.path}:${entry.fragment.startLine}–${entry.fragment.endLine}`}
        </code>
        {entry.operation && (
          <span className="text-muted-foreground">
            {operationLabel(t, entry.operation, index)} · {formatTime(entry.link.timestamp, locale)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {entry.suspect ? (
            <Badge variant="destructive" size="sm" title={t('traceability.elements.suspectHelp')}>
              <AlertTriangle className="mr-1 size-3" />
              {t('traceability.status.suspect')}
            </Badge>
          ) : (
            <Badge variant="soft" size="sm">
              <CheckCircle2 className="mr-1 size-3" />
              {t('traceability.status.upToDate')}
            </Badge>
          )}
        </span>
      </div>
      {lines && !unfolded && (
        <button
          type="button"
          onClick={() => setUnfolded(true)}
          className="w-full px-3 py-2 text-left text-xs text-brand-dark hover:underline dark:text-brand-light"
        >
          {t('traceability.elements.showFile', { count: lines.length })}
        </button>
      )}
      {lines && unfolded ? (
        <pre className="max-h-72 overflow-auto bg-background p-0 text-xs leading-5">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground">{(entry.fragment.startLine ?? 1) + i}</span>
              <code className="whitespace-pre">{line}</code>
            </div>
          ))}
        </pre>
      ) : (
        !lines && <p className="px-3 py-2 text-xs text-muted-foreground">{t('traceability.elements.contentNotKept')}</p>
      )}
      {rule && rule.type === 'RuleEvidence' && (
        <div className="border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
          {t('traceability.elements.evidence', { rule: rule.rule, confidence: entry.link.confidence?.value ?? '–' })}
        </div>
      )}
    </div>
  );
};
