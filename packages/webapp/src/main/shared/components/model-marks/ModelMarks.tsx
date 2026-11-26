/**
 * Marks drawn over the canvas, shared by every overlay that points at elements: who added
 * what after a GitHub pull, what the assistant changed, the element opened from "Your model".
 * Everything is placed from the positions of the editor's `[data-id]` elements, so the model,
 * and any colour someone chose for an element, stay as they are.
 */
import React, { useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import { pathMidpoint } from '../../services/github/modelChanges';

/** What a change does to an element: the same colours wherever a change is marked. */
export const CHANGE_COLORS = { added: '#15803d', modified: '#b45309', deleted: '#be123c' } as const;
export type ChangeKind = keyof typeof CHANGE_COLORS;

// Names one line lists before "and N more".
const MAX_LISTED_NAMES = 4;

export interface Box {
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
export function relationshipLine(id: string, box: Box): { x: number; y: number }[] | null {
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

export const Chip: React.FC<{ label: string; color: string; style: React.CSSProperties }> = ({ label, color, style }) => (
  <span
    className="absolute whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 text-white shadow-elevation-1"
    style={{ backgroundColor: color, ...style }}
  >
    {label}
  </span>
);

/** An element tinted in `color` with a ring around it, over the box the editor draws; `dashed` for one that is gone. */
export const ElementMark: React.FC<{ box: Box; color: string; testId: string; className?: string; dashed?: boolean }> = ({
  box,
  color,
  testId,
  className,
  dashed,
}) => (
  <div
    data-testid={testId}
    className={cn('absolute rounded-[2px]', dashed && 'border-2 border-dashed', className)}
    style={{
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      ...(dashed ? { borderColor: color } : { boxShadow: `0 0 0 2px ${color}` }),
    }}
  />
);

/** A relationship in `color`, over the line the editor draws, with `label` on it. */
export const RelationshipMark: React.FC<{
  points: { x: number; y: number }[];
  color: string;
  label: string | null;
  testId: string;
  dashed?: boolean;
}> = ({ points, color, label, testId, dashed }) => {
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
          strokeDasharray={dashed ? '6 4' : undefined}
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

/** One line of a banner: a dot in `color`, then what happened. */
export const MarkLine: React.FC<{ color: string; text: string; title: string }> = ({ color, text, title }) => (
  <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={title}>
    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
    <span className="truncate">{text}</span>
  </p>
);
