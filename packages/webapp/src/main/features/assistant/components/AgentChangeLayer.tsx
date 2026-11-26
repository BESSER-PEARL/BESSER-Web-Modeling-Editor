/**
 * Over the canvas: what the assistant changed in its last few edits of the open diagram.
 *
 * Added elements and relationships are marked green, modified ones amber, and deleted ones are
 * drawn as red ghosts where they were, with the GitHub collaboration's own marks; older edits
 * are drawn fainter. The marks stay until the user clears them, and live in this browser only
 * (`agentChangeMarks.ts`), so the model and its exports never change.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '../../../app/hooks/useProject';
import {
  CHANGE_COLORS,
  Chip,
  ElementMark,
  MarkLine,
  RelationshipMark,
  joinNames,
  relationshipLine,
  useElementBoxes,
  type Box,
  type ChangeKind,
} from '../../../shared/components/model-marks/ModelMarks';
import {
  clearAgentChanges,
  elementName,
  relationshipName,
  type AgentIteration,
  type Bounds,
  type DeletedMark,
} from '../../../shared/services/agentChanges/agentChanges';
import { AGENT_CHANGES_EVENT, readAgentChanges } from '../../../shared/services/storage/agentChangeMarks';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';

// The newest edit in full, each older one fainter.
const AGE_OPACITY = [1, 0.6, 0.35];

type Loose = Record<string, unknown>;

interface Mark {
  id: string;
  kind: Exclude<ChangeKind, 'deleted'>;
  age: number;
  relationship: boolean;
}

/** The open diagram's marks, read again whenever they change. */
function useIterations(projectId: string | undefined, diagramId: string | undefined): AgentIteration[] {
  const [iterations, setIterations] = useState<AgentIteration[]>([]);
  useEffect(() => {
    if (!projectId || !diagramId) {
      setIterations([]);
      return undefined;
    }
    const read = () => setIterations(readAgentChanges(projectId, diagramId));
    const onChange = (event: Event) => {
      if ((event as CustomEvent<{ projectId?: string }>).detail?.projectId === projectId) read();
    };
    read();
    window.addEventListener(AGENT_CHANGES_EVENT, onChange);
    return () => window.removeEventListener(AGENT_CHANGES_EVENT, onChange);
  }, [projectId, diagramId]);
  return iterations;
}

/** What to mark on the open diagram, newest edit first, against the model as it is now. */
export function useAgentChangeMarks() {
  const { currentProject } = useProject();
  const diagram = currentProject ? getActiveDiagram(currentProject, currentProject.currentDiagramType) : undefined;
  const model = isUMLModel(diagram?.model) ? (diagram!.model as unknown as Loose) : undefined;
  const iterations = useIterations(model ? currentProject?.id : undefined, diagram?.id);

  return useMemo(() => {
    const elements = (model?.elements ?? {}) as Record<string, Loose>;
    const relationships = (model?.relationships ?? {}) as Record<string, Loose>;
    const marks = new Map<string, Mark>();
    const ghosts = new Map<string, DeletedMark & { age: number }>();
    iterations.forEach((iteration, age) => {
      const note = (ids: string[], kind: Mark['kind']) => {
        for (const id of ids) {
          if (marks.has(id) || (!elements[id] && !relationships[id])) continue;
          marks.set(id, { id, kind, age, relationship: !elements[id] });
        }
      };
      note(iteration.added, 'added');
      note(iteration.modified, 'modified');
      for (const mark of iteration.deleted) {
        if (!ghosts.has(mark.id) && !elements[mark.id] && !relationships[mark.id]) ghosts.set(mark.id, { ...mark, age });
      }
    });
    // A new element's new members are part of it: one mark, on the element.
    const drawn = [...marks.values()].filter(({ id }) => {
      const owner = elements[id]?.owner;
      return !(typeof owner === 'string' && marks.get(owner)?.kind === 'added');
    });
    const label = (id: string) =>
      elements[id] ? elementName(id, elements) : relationshipName(id, { elements, relationships });
    return { projectId: currentProject?.id, diagramId: diagram?.id, elements, iterations, drawn, ghosts: [...ghosts.values()], label };
  }, [model, iterations, currentProject?.id, diagram?.id]);
}

/** A top-level element on the canvas, to place model coordinates on screen through every pan and zoom. */
function referenceElement(elements: Record<string, Loose>): { id: string; bounds: Bounds } | undefined {
  for (const [id, element] of Object.entries(elements)) {
    const bounds = element.bounds as Bounds | undefined;
    if (!element.owner && bounds && typeof bounds.width === 'number' && bounds.width > 0) return { id, bounds };
  }
  return undefined;
}

export const AgentChangeLayer: React.FC = () => {
  const { t } = useTranslation();
  const { elements, drawn, ghosts } = useAgentChangeMarks();
  const layer = useRef<HTMLDivElement>(null);
  const reference = useMemo(() => (ghosts.length ? referenceElement(elements) : undefined), [ghosts.length, elements]);
  const tracked = useMemo(
    () => [...drawn.map(({ id }) => id), ...(reference ? [reference.id] : [])],
    [drawn, reference],
  );
  const boxes = useElementBoxes(tracked, layer);

  if (!drawn.length && !ghosts.length) return null;

  const referenceBox = reference ? boxes[reference.id] : undefined;
  const scale = referenceBox && reference ? referenceBox.width / reference.bounds.width : 0;
  const toScreen = (x: number, y: number) => ({
    x: (referenceBox?.left ?? 0) + (x - (reference?.bounds.x ?? 0)) * scale,
    y: (referenceBox?.top ?? 0) + (y - (reference?.bounds.y ?? 0)) * scale,
  });
  const chipLabel = (kind: ChangeKind) => t(`assistant.changes.chip.${kind}`);

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {drawn.map(({ id, kind, age, relationship }) => {
        const box = boxes[id];
        if (!box) return null;
        const color = CHANGE_COLORS[kind];
        const style = { opacity: AGE_OPACITY[age] ?? AGE_OPACITY[AGE_OPACITY.length - 1] };
        if (relationship) {
          const points = relationshipLine(id, box);
          return (
            points && (
              <div key={id} className="absolute inset-0" style={style}>
                <RelationshipMark testId={`agent-${kind}-relationship`} color={color} label={age === 0 ? chipLabel(kind) : null} points={points} />
              </div>
            )
          );
        }
        const isMember = typeof elements[id]?.owner === 'string';
        return (
          <div key={id} className="absolute inset-0" style={style}>
            <ElementMark testId={`agent-${kind}-element`} color={color} box={box} />
            {age === 0 && (
              <Chip
                label={chipLabel(kind)}
                color={color}
                style={isMember ? { left: box.right + 6, top: box.top } : { left: box.left, top: box.top - 26 }}
              />
            )}
          </div>
        );
      })}

      {scale > 0 &&
        ghosts.map(({ id, bounds, points, age }) => {
          const style = { opacity: AGE_OPACITY[age] ?? AGE_OPACITY[AGE_OPACITY.length - 1] };
          const color = CHANGE_COLORS.deleted;
          if (points) {
            return (
              <div key={id} className="absolute inset-0" style={style}>
                <RelationshipMark
                  testId="agent-deleted-relationship"
                  color={color}
                  dashed
                  label={age === 0 ? chipLabel('deleted') : null}
                  points={points.map(({ x, y }) => toScreen(x, y))}
                />
              </div>
            );
          }
          if (!bounds) return null;
          const { x: left, y: top } = toScreen(bounds.x, bounds.y);
          const box: Box = { left, top, width: bounds.width * scale, height: bounds.height * scale, right: left + bounds.width * scale };
          return (
            <div key={id} className="absolute inset-0" style={style}>
              <ElementMark testId="agent-deleted-element" color={color} box={box} dashed />
              {age === 0 && <Chip label={chipLabel('deleted')} color={color} style={{ left: box.left, top: box.top - 26 }} />}
            </div>
          );
        })}
    </div>
  );
};

/** What the assistant's last edit changed, with the colours as a legend, until the user clears the marks. */
export const AgentChangeBanner: React.FC = () => {
  const { t } = useTranslation();
  const { projectId, diagramId, iterations, drawn, ghosts, label } = useAgentChangeMarks();
  if (!projectId || !diagramId || (!drawn.length && !ghosts.length)) return null;

  const latest = iterations[0];
  const shown = new Set(drawn.map(({ id }) => id));
  const lines: { kind: ChangeKind; names: string[] }[] = [
    { kind: 'added', names: (latest?.added ?? []).filter((id) => shown.has(id)).map(label) },
    { kind: 'modified', names: (latest?.modified ?? []).filter((id) => shown.has(id)).map(label) },
    { kind: 'deleted', names: ghosts.filter(({ age }) => age === 0).map(({ label: name }) => name) },
  ];

  return (
    <div
      role="region"
      aria-label={t('assistant.changes.title')}
      className="pointer-events-auto flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 text-sm shadow-elevation-2 backdrop-blur"
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('assistant.changes.title')}</p>
        {lines.map(
          ({ kind, names }) =>
            names.length > 0 && (
              <MarkLine
                key={kind}
                color={CHANGE_COLORS[kind]}
                title={names.join(', ')}
                text={t(`assistant.changes.${kind}`, { items: joinNames(t, names) })}
              />
            ),
        )}
        {iterations.length > 1 && <p className="mt-1 text-xs text-muted-foreground">{t('assistant.changes.earlier')}</p>}
      </div>
      <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => clearAgentChanges(projectId, diagramId)}>
        <X className="size-3.5" aria-hidden />
        {t('assistant.changes.clear')}
      </Button>
    </div>
  );
};
