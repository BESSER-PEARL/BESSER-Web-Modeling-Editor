import { readWhatsNewState, writeWhatsNewSeen } from '../../shared/services/storage/preferencesStorage';
import type { SupportedDiagramType } from '../../shared/types/project';

export interface WhatsNewEntry {
  /** Key under `whatsNew.entries` in the locale files. */
  id: string;
  /** The BESSER release that shipped it. */
  version: string;
  /** Release date, `YYYY-MM-DD`. */
  date: string;
  /** A diagram type the entry introduces; the entry then offers to open it. */
  diagramType?: SupportedDiagramType;
}

/** Newest first. Keep the last few releases; the release notes hold the full history. */
export const WHATS_NEW: WhatsNewEntry[] = [
  { id: 'repoTogether', version: '8.9.0', date: '2026-11-05' },
  { id: 'keepEdits', version: '8.8.0', date: '2026-11-04' },
  { id: 'anyStack', version: '8.7.0', date: '2026-11-02' },
  { id: 'githubRepo', version: '8.6.0', date: '2026-10-30' },
  { id: 'knowledgeGraph', version: '8.5.0', date: '2026-10-28', diagramType: 'KnowledgeGraphDiagram' },
];

export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

/** Record that the user has seen every entry. */
export function markAllSeen(entries: WhatsNewEntry[], storage?: Storage): void {
  if (entries.length === 0) return;
  writeWhatsNewSeen(entries[0].version, storage);
}

/**
 * How many entries are newer than the version the user last saw. With nothing
 * recorded, a browser that already holds a project belongs to a returning user
 * who has seen none of them; a first visit has nothing to catch up on.
 */
export function countUnread(entries: WhatsNewEntry[], storage?: Storage): number {
  const state = readWhatsNewState(storage);
  if (!state) return 0;
  if (state.seen === null) {
    if (state.hasProject) return entries.length;
    markAllSeen(entries, storage);
    return 0;
  }
  const seen = state.seen;
  return entries.filter((entry) => compareVersions(entry.version, seen) > 0).length;
}
