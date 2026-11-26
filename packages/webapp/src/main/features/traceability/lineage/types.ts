/** What the lineage detail pane shows: a row (an artifact or a generation run) or a link. */
export type LineageSelection = { kind: 'node'; id: string } | { kind: 'edge'; id: string };

/** Zoom levels of the canvas; 1 is the natural size. */
export const ZOOM_LEVELS = [0.5, 0.67, 0.8, 1, 1.25, 1.5];
