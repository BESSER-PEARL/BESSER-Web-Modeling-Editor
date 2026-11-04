/**
 * Over the canvas of a linked project: who added what.
 *
 * Elements a pull brought in are tinted in their author's colour with the
 * author's login beside them, until the user clears the marks; hovering any
 * credited element says who added it. Everything here is drawn over the canvas
 * from the positions of `[data-id]` elements, so the model, and any colour
 * someone chose for an element, stay as they are. The marks live in the
 * project's link in this browser and never reach the repository.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitPullRequestArrow, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '../../../app/hooks/useProject';
import { setProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import {
  classModelElements,
  elementLabel,
  type ClassModelElement,
} from '../../../shared/services/github/modelAttribution';
import type { ElementAttribution } from '../../../shared/types/project';
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

const elementNode = (id: string): Element | null =>
  document.querySelector(`[data-id="${id.replace(/["\\]/g, '\\$&')}"]`);

/** An element's box on screen. An SVG element's rendered bounds also cover its hover handles, so use its own size. */
function screenRect(node: Element): Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> {
  const matrix = node instanceof SVGSVGElement ? node.getScreenCTM?.() : null;
  if (!matrix) return node.getBoundingClientRect();
  const { value: width } = (node as SVGSVGElement).width.baseVal;
  const { value: height } = (node as SVGSVGElement).height.baseVal;
  return { left: matrix.e, top: matrix.f, width: width * matrix.a, height: height * matrix.d };
}

/** Where the elements `ids` are, relative to `layer`, following every pan, zoom and move. */
function useElementBoxes(ids: string[], layer: React.RefObject<HTMLDivElement | null>): Record<string, Box> {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const key = ids.join('|');
  useEffect(() => {
    if (!key) {
      setBoxes({});
      return undefined;
    }
    let frame = 0;
    let last = '';
    const measure = () => {
      const origin = layer.current?.getBoundingClientRect();
      const next: Record<string, Box> = {};
      for (const id of origin ? key.split('|') : []) {
        const node = elementNode(id);
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
function useHoveredElement(attribution: Record<string, ElementAttribution> | undefined): string | null {
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    if (!attribution) return undefined;
    const onOver = (event: MouseEvent) => {
      const id = (event.target as Element | null)?.closest?.('[data-id]')?.getAttribute('data-id');
      setHovered(id && attribution[id] ? id : null);
    };
    document.addEventListener('mouseover', onOver);
    return () => {
      document.removeEventListener('mouseover', onOver);
      setHovered(null);
    };
  }, [attribution]);
  return hovered;
}

const Chip: React.FC<{ login: string; style: React.CSSProperties }> = ({ login, style }) => (
  <span
    className="absolute whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white shadow-elevation-1"
    style={{ backgroundColor: authorColor(login), ...style }}
  >
    @{login}
  </span>
);

export const ModelAttributionLayer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentProject } = useProject();
  const { link } = useRepoSync({ checkRemote: false });
  const layer = useRef<HTMLDivElement>(null);

  const attribution = currentProject?.attribution;
  const elements = useMemo(
    () => (currentProject ? classModelElements(currentProject) : new Map<string, ClassModelElement>()),
    [currentProject],
  );
  const marked = useMemo(
    () => (link?.newFromRepo ?? []).filter((id) => elements.has(id) && attribution?.[id]),
    [link?.newFromRepo, elements, attribution],
  );
  // A new class's new members are part of it: one tint and one chip, on the class.
  const drawn = useMemo(() => {
    const markedIds = new Set(marked);
    return marked.filter((id) => !markedIds.has(elements.get(id)?.ownerId ?? ''));
  }, [marked, elements]);

  const hovered = useHoveredElement(link && attribution ? attribution : undefined);
  const tracked = useMemo(() => (hovered && !drawn.includes(hovered) ? [...drawn, hovered] : drawn), [drawn, hovered]);
  const boxes = useElementBoxes(tracked, layer);

  if (!currentProject || !link) return null;

  const clear = () => {
    const { newFromRepo: _cleared, ...rest } = link;
    setProjectGitHubLink(currentProject.id, rest);
  };

  const byAuthor = new Map<string, string[]>();
  for (const id of drawn) {
    const author = attribution?.[id]?.addedBy ?? '';
    const element = elements.get(id);
    if (element) byAuthor.set(author, [...(byAuthor.get(author) ?? []), elementLabel(element, elements)]);
  }

  const hoveredRecord = hovered ? attribution?.[hovered] : undefined;
  const hoveredBox = hovered ? boxes[hovered] : undefined;

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {drawn.map((id) => {
        const box = boxes[id];
        const login = attribution?.[id]?.addedBy;
        if (!box || !login) return null;
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
              login={login}
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

      {byAuthor.size > 0 && !link.modelProposal && (
        <div
          role="region"
          aria-label={t('github.attribution.title')}
          className="pointer-events-auto absolute left-1/2 top-3 flex max-w-2xl -translate-x-1/2 items-start gap-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 text-sm shadow-elevation-2 backdrop-blur"
        >
          <GitPullRequestArrow className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('github.attribution.title')}</p>
            {[...byAuthor].map(([author, names]) => {
              const listed = names.slice(0, MAX_LISTED_NAMES).join(', ');
              const hidden = names.length - MAX_LISTED_NAMES;
              return (
                <p key={author} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={names.join(', ')}>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: authorColor(author) }}
                    aria-hidden
                  />
                  <span className="truncate">
                    {t('github.attribution.added', {
                      author: `@${author}`,
                      items: hidden > 0 ? t('github.attribution.more', { items: listed, count: hidden }) : listed,
                    })}
                  </span>
                </p>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={clear}>
            <X className="size-3.5" aria-hidden />
            {t('github.attribution.clear')}
          </Button>
        </div>
      )}
    </div>
  );
};
