/**
 * Centralized z-index scale.
 *
 * All z-index values across the application should reference these constants
 * so that stacking order remains predictable and maintainable.
 *
 * Scale:
 *   BELOW        -1   Hidden panels, backgrounds behind content
 *   BASE          0   Normal document flow
 *   DROPDOWN     10   Dropdowns, tooltips, inline popovers
 *   STICKY       20   Fixed navigation bars, sidebars, sticky headers
 *   POPOVER      30   Floating panels, popovers, drawer backdrops
 *   MODAL        40   Modals, dialogs, drawer content, sidebar overlays
 *   NOTIFICATION 50   Error toasts, notifications, sidebar panels
 *   OVERLAY      60   Cookie consent, critical full-screen overlays
 *   MAX          70   Absolute ceiling -- nothing should exceed this
 */
export const Z_INDEX = {
  /** Below content (hidden panels, backgrounds) */
  BELOW: -1,
  /** Normal content flow */
  BASE: 0,
  /** Dropdowns, tooltips, inline popovers */
  DROPDOWN: 10,
  /** Fixed navigation, sidebars, sticky headers */
  STICKY: 20,
  /** Floating panels, popovers, drawer backdrops */
  POPOVER: 30,
  /** Modals, dialogs, drawer content, sidebar overlays */
  MODAL: 40,
  /** Error panels, notifications, sidebar panels */
  NOTIFICATION: 50,
  /** Cookie consent, critical overlays */
  OVERLAY: 60,
  /** Maximum -- nothing should be above this */
  MAX: 70,
} as const;

export type ZIndexLevel = (typeof Z_INDEX)[keyof typeof Z_INDEX];
