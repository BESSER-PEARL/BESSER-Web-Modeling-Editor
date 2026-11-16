/**
 * Over the canvas of a linked project: who added what.
 *
 * Elements and relationships a pull brought in are marked in their author's colour with
 * the author's login beside them, until the user clears the marks; hovering any
 * credited element says who added it. Everything here is drawn over the canvas
 * from the positions of `[data-id]` elements, so the model, and any colour
 * someone chose for an element, stay as they are. The marks live in the
 * project's link in this browser and never reach the repository.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { GitPullRequestArrow, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '../../../app/hooks/useProject';
import { setProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import {
  classModelElements,
  classRelationships,
  elementLabel,
  elementRecords,
  relationshipLabel,
  type ClassModelElement,
  type ClassRelationship,
} from '../../../shared/services/github/modelAttribution';
import { pathMidpoint } from '../../../shared/services/github/modelChanges';
import type { ElementAttribution } from '../../../shared/types/project';
import { useRepoChangePreviewOpen } from '../hooks/useRepoChangePreview';
import { useRepoSync } from '../hooks/useRepoSync';

// All readable under white text, in both themes.
const AUTHOR_COLORS = ['#0f766e', '#b45309', '#7c3aed', '#be123c', '#1d4ed8', '#15803d'];
// Names one author's line lists before "and N more".
const MAX_LISTED_NAMES = 4;

/** The same login always gets the same colour. */
export function authorColor(login: string): string {
  let hash = 0;
  for (const char of login) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

interface Box {
  left: number;
  top: number;
  right: number;
  width: number;
  height: number;
}

const elementNode = (id: string): Element | null => document.querySelector(`[data-id="${CSS.escape(id)}"]`);

/**
 * An element's box on screen. An SVG element's rendered bounds also cover its hover handles, so use its own size.
 * Its position comes from its content: Firefox's getScreenCTM() on a nested <svg> ignores that svg's own x and y.
 */
function screenRect(node: Element): Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> {
  const content = node.firstElementChild as SVGGraphicsElement | null;
  const matrix = node instanceof SVGSVGElement ? content?.getScreenCTM?.() ?? node.getScreenCTM?.() : null;
  if (!matrix) return node.getBoundingClientRect();
  const { value: width } = (node as SVGSVGElement).width.baseVal;
  const { value: height } = (node as SVGSVGElement).height.baseVal;
  return { left: matrix.e, top: matrix.f, width: width * matrix.a, height: height * matrix.d };
}

/** A relationship's line within its box, read from what the editor drew: it re-routes a saved path on load. */
function relationshipLine(id: string, box: Box): { x: number; y: number }[] | null {
  const line = elementNode(id)?.querySelector('polyline');
  const matrix = line?.getScreenCTM?.();
  if (!line?.points?.length || !matrix) return null;
  return Array.from(line.points).map((point) => ({ x: box.left + point.x * matrix.a, y: box.top + point.y * matrix.d }));
}

/** Where the elements `ids` are, relative to `layer`, following every pan, zoom and move. */
export function useElementBoxes(ids: string[], layer: React.RefObject<HTMLDivElement | null>): Record<string, Box> {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const key = ids.join('|');
  useEffect(() => {
    if (!key) {
      setBoxes({});
      return undefined;
    }
    let frame = 0;
    let last = '';
    const nodes = new Map<string, Element>();
    const measure = () => {
      const origin = layer.current?.getBoundingClientRect();
      const next: Record<string, Box> = {};
      for (const id of origin ? key.split('|') : []) {
        let node = nodes.get(id);
        if (!node?.isConnected) {
          node = elementNode(id) ?? undefined;
          if (node) nodes.set(id, node);
        }
        if (node && origin) {
          const rect = screenRect(node);
          const left = rect.left - origin.left;
          next[id] = { left, top: rect.top - origin.top, right: left + rect.width, width: rect.width, height: rect.height };
        }
      }
      const text = JSON.stringify(next);
      if (text !== last) {
        last = text;
        setBoxes(next);
      }
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [key, layer]);
  return boxes;
}

/** The credited element under the pointer. */
function useHoveredElement(records: Map<string, ElementAttribution> | undefined): string | null {
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    if (!records) return undefined;
    const onOver = (event: MouseEvent) => {
      const id = (event.target as Element | null)?.closest?.('[data-id]')?.getAttribute('data-id');
      setHovered(id && records.has(id) ? id : null);
    };
    document.addEventListener('mouseover', onOver);
    return () => {
      document.removeEventListener('mouseover', onOver);
      setHovered(null);
    };
  }, [records]);
  return hovered;
}

/** The current project's credits and marks; empty on any editor but the class diagram's. */
function useAttributionMarks() {
  const { currentProject } = useProject();
  const { link } = useRepoSync({ checkRemote: false });
  const active = !!link && currentProject?.currentDiagramType === 'ClassDiagram';

  const records = useMemo(() => (active ? elementRecords(currentProject) : undefined), [active, currentProject]);
  const elements = useMemo(
    () => (active && currentProject ? classModelElements(currentProject) : new Map<string, ClassModelElement>()),
    [active, currentProject],
  );
  const relationships = useMemo(
    () => (active && currentProject ? classRelationships(currentProject) : new Map<string, ClassRelationship>()),
    [active, currentProject],
  );
  const marked = useMemo(
    () => (link?.newFromRepo ?? []).filter((id) => (elements.has(id) || relationships.has(id)) && records?.has(id)),
    [link?.newFromRepo, elements, relationships, records],
  );
  // A new class's new members are part of it: one tint and one chip, on the class.
  const drawn = useMemo(() => {
    const markedIds = new Set(marked);
    return marked.filter((id) => !markedIds.has(elements.get(id)?.ownerId ?? ''));
  }, [marked, elements]);

  return { projectId: currentProject?.id, link, records, elements, relationships, drawn };
}

export const Chip: React.FC<{ label: string; color: string; style: React.CSSProperties }> = ({ label, color, style }) => (
  <span
    className="absolute whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white shadow-elevation-1"
    style={{ backgroundColor: color, ...style }}
  >
    {label}
  </span>
);

/** A relationship in its author's colour, over the line the editor draws, with their login on it. */
export const RelationshipMark: React.FC<{
  points: { x: number; y: number }[];
  color: string;
  label: string | null;
  testId: string;
}> = ({ points, color, label, testId }) => {
  const middle = pathMidpoint(points);
  return (
    <>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <polyline
          data-testid={testId}
          points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={3}
        />
      </svg>
      {label && middle && (
        <Chip label={label} color={color} style={{ left: middle.x, top: middle.y, transform: 'translate(-50%, -50%)' }} />
      )}
    </>
  );
};

/** Names for one line of a banner, cut short after a few. */
export function joinNames(t: TFunction, names: string[]): string {
  const listed = names.slice(0, MAX_LISTED_NAMES).join(', ');
  const hidden = names.length - MAX_LISTED_NAMES;
  return hidden > 0 ? t('github.attribution.more', { items: listed, count: hidden }) : listed;
}

/** One line of a banner: a dot in the author's colour, then what they did. */
export const AuthorLine: React.FC<{ author: string; text: string; title: string }> = ({ author, text, title }) => (
  <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={title}>
    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: authorColor(author) }} aria-hidden />
    <span className="truncate">{text}</span>
  </p>
);

export const ModelAttributionLayer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { link, records, elements, relationships, drawn } = useAttributionMarks();
  const layer = useRef<HTMLDivElement>(null);

  const hovered = useHoveredElement(records);
  const tracked = useMemo(() => (hovered && !drawn.includes(hovered) ? [...drawn, hovered] : drawn), [drawn, hovered]);
  const boxes = useElementBoxes(tracked, layer);

  if (!records || !link) return null;

  const hoveredRecord = hovered ? records.get(hovered) : undefined;
  const hoveredBox = hovered ? boxes[hovered] : undefined;

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {drawn.map((id) => {
        const box = boxes[id];
        const login = records.get(id)?.addedBy;
        if (!box || !login) return null;
        if (relationships.has(id)) {
          const points = relationshipLine(id, box);
          return (
            points && (
              <React.Fragment key={id}>
                <RelationshipMark testId="new-relationship-mark" color={authorColor(login)} label={`@${login}`} points={points} />
              </React.Fragment>
            )
          );
        }
        const isMember = !!elements.get(id)?.ownerId;
        return (
          <React.Fragment key={id}>
            <div
              data-testid="new-element-tint"
              className="absolute rounded-[2px]"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                backgroundColor: `${authorColor(login)}26`,
                boxShadow: `0 0 0 2px ${authorColor(login)}`,
              }}
            />
            <Chip
              label={`@${login}`}
              color={authorColor(login)}
              style={isMember ? { left: box.right + 6, top: box.top } : { left: box.left, top: box.top - 26 }}
            />
          </React.Fragment>
        );
      })}

      {hoveredRecord && hoveredBox && (
        <span
          role="tooltip"
          className="absolute whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-elevation-2"
          style={{ left: hoveredBox.left, top: hoveredBox.top + hoveredBox.height + 6 }}
        >
          {t('github.attribution.addedBy', {
            author: `@${hoveredRecord.addedBy}`,
            date: new Date(hoveredRecord.addedAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' }),
          })}
        </span>
      )}
    </div>
  );
};

/** What the last pull brought in, by author, until the user clears the marks. */
export const ModelAttributionBanner: React.FC = () => {
  const { t } = useTranslation();
  const { projectId, link, records, elements, relationships, drawn } = useAttributionMarks();
  const previewing = useRepoChangePreviewOpen();

  const byAuthor = new Map<string, string[]>();
  for (const id of drawn) {
    const author = records?.get(id)?.addedBy ?? '';
    const element = elements.get(id);
    const relationship = relationships.get(id);
    const label = element ? elementLabel(element, elements) : relationship && relationshipLabel(relationship, elements);
    if (label) byAuthor.set(author, [...(byAuthor.get(author) ?? []), label]);
  }
  if (!projectId || !link || byAuthor.size === 0 || link.modelProposal || previewing) return null;

  const clear = () => {
    const { newFromRepo: _cleared, ...rest } = link;
    setProjectGitHubLink(projectId, rest);
  };

  return (
    <div
      role="region"
      aria-label={t('github.attribution.title')}
      className="pointer-events-auto flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 text-sm shadow-elevation-2 backdrop-blur"
    >
      <GitPullRequestArrow className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('github.attribution.title')}</p>
        {[...byAuthor].map(([author, names]) => (
          <AuthorLine
            key={author}
            author={author}
            title={names.join(', ')}
            text={t('github.attribution.added', { author: `@${author}`, items: joinNames(t, names) })}
          />
        ))}
      </div>
      <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={clear}>
        <X className="size-3.5" aria-hidden />
        {t('github.attribution.clear')}
      </Button>
    </div>
  );
};
