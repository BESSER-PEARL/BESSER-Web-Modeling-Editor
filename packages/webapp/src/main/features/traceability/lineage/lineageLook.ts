import type { TraceEvidence } from '../../../shared/types/traceability';
import type { LineageBundle, LineageEdge } from '../../../shared/traceability/lineage';

/** How links are drawn on the lineage canvas. */

/** Stroke colour per evidence kind; a link that may no longer hold is amber whatever its evidence. */
export const EVIDENCE_STROKES: Record<TraceEvidence['type'], string> = {
  RuleEvidence: 'stroke-slate-400 dark:stroke-slate-500',
  AIEvidence: 'stroke-violet-500',
};
export const OUT_OF_DATE_STROKE = 'stroke-warning';

/** How a link is drawn: amber, solid when one of its own ends changed, dashed when only something upstream did. */
export type LinkLook = 'upToDate' | 'endChanged' | 'upstreamChanged';
export const lookOf = (edge: LineageEdge): LinkLook =>
  edge.outOfDate.length === 0 ? 'upToDate' : edge.outOfDate.some((r) => r !== 'UPSTREAM_CHANGED') ? 'endChanged' : 'upstreamChanged';

/** Whether an AI decision made the link (so its pill says so: not by colour alone). */
export const isAiEdge = (edge: LineageEdge) => edge.link.evidence.some((e) => e.type === 'AIEvidence');

/** How a bundle of links is drawn: as its least sure link, amber when any of them may not hold. */
export function bundleLook(edges: LineageEdge[]): LineageEdge {
  const weakest = edges.reduce((a, b) => ((b.link.confidence?.value ?? 1) < (a.link.confidence?.value ?? 1) ? b : a));
  return edges.find((e) => lookOf(e) === 'endChanged') ?? edges.find((e) => lookOf(e) === 'upstreamChanged') ?? weakest;
}

/** Whether a connector carries a pill: a bundle, an AI link, a link below full confidence, or one that may not hold. */
export function hasPill(bundle: LineageBundle): boolean {
  const look = bundleLook(bundle.edges);
  return bundle.edges.length > 1 || isAiEdge(look) || (look.link.confidence?.value ?? 1) < 1 || lookOf(look) !== 'upToDate';
}

export const formatConfidence = (value: number | undefined) => (value === undefined ? '–' : value.toFixed(2));

/** Where along a connector its pill sits: 0 at the source, 1 at the target. */
export const PILL_AT = 0.78;
/** One coordinate of a cubic Bézier curve at `t`. */
export const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
