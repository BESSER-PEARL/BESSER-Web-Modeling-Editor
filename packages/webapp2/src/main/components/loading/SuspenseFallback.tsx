import React from 'react';
import { SkeletonLine, SkeletonBlock } from './SkeletonLoader';

/* ────────────────────────────────────────────────────────────────────────────
 * SuspenseFallback
 *
 * A branded loading placeholder used as the fallback for React.lazy /
 * Suspense boundaries.  Instead of a bare spinner it now renders the BESSER
 * logo, an animated progress bar, and optional skeleton lines so the user
 * sees a recognisable, low-layout-shift placeholder while code-split chunks
 * are being downloaded.
 *
 * It adapts to the parent container's height — works both as a full-page
 * placeholder and inside smaller panels.
 * ──────────────────────────────────────────────────────────────────────────── */

interface SuspenseFallbackProps {
  /** Optional message shown below the progress bar. */
  message?: string;
  /**
   * When true, skeleton text lines are rendered beneath the message
   * to hint at upcoming content.  Useful for full-page boundaries;
   * pass `false` for tight panel placeholders.
   */
  showSkeleton?: boolean;
}

export const SuspenseFallback: React.FC<SuspenseFallbackProps> = ({
  message = 'Loading...',
  showSkeleton = false,
}) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-slate-500 dark:text-slate-400">
    {/* App logo */}
    <img
      src="/images/logo.png"
      alt="BESSER"
      className="h-8 w-auto opacity-60 brightness-0 dark:invert"
    />

    {/* Animated progress bar */}
    <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="h-full w-1/3 animate-[progress-slide_1.4s_ease-in-out_infinite] rounded-full bg-[#397C95]" />
    </div>

    {/* Message */}
    <span className="text-sm font-medium">{message}</span>

    {/* Optional skeleton lines */}
    {showSkeleton && (
      <div className="mt-4 flex w-full max-w-md flex-col gap-3">
        <SkeletonLine width="90%" />
        <SkeletonLine width="70%" />
        <SkeletonLine width="80%" />
        <SkeletonBlock height="120px" className="mt-2 rounded-lg" />
      </div>
    )}

    {/* Inline keyframe — scoped to this component so it works even if
        the tailwind config hasn't been extended with this animation. */}
    <style>{`
      @keyframes progress-slide {
        0%   { transform: translateX(-150%); }
        100% { transform: translateX(450%); }
      }
    `}</style>
  </div>
);
