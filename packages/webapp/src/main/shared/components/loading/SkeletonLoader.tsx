import React from 'react';

/* ────────────────────────────────────────────────────────────────────────────
 * Reusable skeleton primitives.
 *
 * All primitives use Tailwind's built-in `animate-pulse` utility for the
 * shimmer effect, and respect dark-mode via `dark:` variants.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SkeletonLineProps {
  /** CSS width value (default '100%'). */
  width?: string;
  /** Extra Tailwind classes. */
  className?: string;
}

/**
 * A single text-line placeholder (height: 1rem by default).
 */
export const SkeletonLine: React.FC<SkeletonLineProps> = ({ width = '100%', className = '' }) => (
  <div
    className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 h-4 ${className}`}
    style={{ width }}
  />
);

export interface SkeletonBlockProps {
  /** CSS height value (default '200px'). */
  height?: string;
  /** Extra Tailwind classes. */
  className?: string;
}

/**
 * A rectangular block placeholder (full width by default).
 */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ height = '200px', className = '' }) => (
  <div
    className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 w-full ${className}`}
    style={{ height }}
  />
);

export interface SkeletonCircleProps {
  /** Diameter in pixels (default 40). */
  size?: number;
  /** Extra Tailwind classes. */
  className?: string;
}

/**
 * A circular avatar / icon placeholder.
 */
export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({ size = 40, className = '' }) => (
  <div
    className={`animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 ${className}`}
    style={{ width: size, height: size }}
  />
);
