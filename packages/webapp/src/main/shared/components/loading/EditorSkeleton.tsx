import React from 'react';
import { SkeletonLine, SkeletonBlock, SkeletonCircle } from './SkeletonLoader';

/* ────────────────────────────────────────────────────────────────────────────
 * EditorSkeleton
 *
 * A full-editor placeholder that mirrors the real layout:
 *   [ narrow sidebar | large canvas area | properties panel ]
 *
 * Used inside <Suspense> boundaries that wrap the editor route so the user
 * sees a recognisable wireframe instead of a blank screen while code-split
 * chunks are downloaded.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Sidebar skeleton — narrow column with icon-sized rectangles that mimic the
 * sidebar navigation items.
 */
const SidebarSkeleton: React.FC = () => (
  <div className="hidden md:flex w-14 shrink-0 flex-col gap-3 border-r border-slate-200/70 dark:border-slate-700/70 bg-white/40 dark:bg-slate-900/40 p-2.5">
    {/* Icon-style nav items */}
    {Array.from({ length: 7 }).map((_, i) => (
      <SkeletonCircle key={i} size={32} className="mx-auto" />
    ))}
    {/* Divider */}
    <div className="my-2 border-t border-slate-200/60 dark:border-slate-700/50" />
    <SkeletonCircle size={32} className="mx-auto" />
  </div>
);

/**
 * Canvas skeleton — the large central editing area.
 */
const CanvasSkeleton: React.FC = () => (
  <div className="flex flex-1 flex-col gap-3 p-4">
    {/* Simulated toolbar */}
    <div className="flex items-center gap-2">
      <SkeletonBlock height="32px" className="w-24 rounded-md" />
      <SkeletonBlock height="32px" className="w-20 rounded-md" />
      <SkeletonBlock height="32px" className="w-16 rounded-md" />
      <div className="flex-1" />
      <SkeletonBlock height="32px" className="w-10 rounded-md" />
    </div>

    {/* Main canvas placeholder */}
    <SkeletonBlock height="100%" className="flex-1 rounded-lg" />
  </div>
);

/**
 * Properties panel skeleton — right column with labelled field placeholders.
 */
const PropertiesSkeleton: React.FC = () => (
  <div className="hidden lg:flex w-60 shrink-0 flex-col gap-4 border-l border-slate-200/70 dark:border-slate-700/70 bg-white/40 dark:bg-slate-900/40 p-4">
    {/* Section title */}
    <SkeletonLine width="50%" className="h-3" />

    {/* Field groups */}
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex flex-col gap-2">
        <SkeletonLine width="40%" className="h-3" />
        <SkeletonBlock height="32px" className="rounded-md" />
      </div>
    ))}

    <div className="my-1 border-t border-slate-200/60 dark:border-slate-700/50" />

    {/* Additional lines */}
    <SkeletonLine width="60%" className="h-3" />
    <SkeletonLine width="80%" className="h-3" />
    <SkeletonLine width="45%" className="h-3" />
  </div>
);

/**
 * Full editor skeleton layout.
 *
 * Renders a sidebar, a main canvas area, and an optional properties panel.
 * Matches the real editor's three-column layout so the transition from
 * skeleton to loaded content feels seamless.
 */
export const EditorSkeleton: React.FC = () => (
  <div className="flex h-full w-full overflow-hidden">
    <SidebarSkeleton />
    <CanvasSkeleton />
    <PropertiesSkeleton />
  </div>
);
