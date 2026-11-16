import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LineageBundle, LineageLayout } from '../../../shared/traceability/lineage';
import { PILL_AT, bezier } from './lineageLook';

/** One drawn connector: a bundle of links between two visible rows. */
export interface Connector {
  bundle: LineageBundle;
  path: string;
  /** Where its pill sits. */
  mid: { x: number; y: number };
}

/**
 * Connectors between the rows of the lineage canvas, measured from the DOM: each row registers its element,
 * and every bundle becomes a curve from its source row's right edge to its target row's left edge, in
 * unzoomed content coordinates. Re-measured when the layout, the zoom or the content's size changes.
 */
export function useConnectorLayout(layout: LineageLayout, zoom: number) {
  const content = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const [connectors, setConnectors] = useState<Connector[]>([]);
  // The canvas scrolls over the zoomed content, so it needs the content's natural size.
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return undefined;
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const local = (value: number, from: number) => (value - from) / zoom;
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
      setConnectors(
        layout.bundles.flatMap((bundle) => {
          const from = anchors.current.get(bundle.sourceId)?.getBoundingClientRect();
          const to = anchors.current.get(bundle.targetId)?.getBoundingClientRect();
          if (!from || !to) return [];
          const sx = local(from.right, origin.left);
          const sy = local(from.top + from.height / 2, origin.top);
          const tx = local(to.left, origin.left);
          const ty = local(to.top + to.height / 2, origin.top);
          const bend = Math.max(40, Math.abs(tx - sx) / 2);
          const [x1, x2] = [sx + bend, tx - bend];
          return [{
            bundle,
            path: `M ${sx} ${sy} C ${x1} ${sy}, ${x2} ${ty}, ${tx} ${ty}`,
            // The pill sits near the target end, where connectors from one source have spread apart.
            mid: { x: bezier(sx, x1, x2, tx, PILL_AT), y: bezier(sy, sy, ty, ty, PILL_AT) },
          }];
        }),
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout, zoom]);

  /** A ref callback for the row of `id`, so connectors can reach it. */
  const register = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node) anchors.current.set(id, node);
      else anchors.current.delete(id);
    },
    [],
  );

  return { content, register, connectors, size };
}
