import React from "react"

/**
 * Thin-stroke icons for the inspector chrome (24px grid, 2px stroke), drawn
 * to match the lucide set the host app uses. Decorative: the owning button
 * carries the accessible name.
 */
const Stroke: React.FC<{ size?: number; children: React.ReactNode }> = ({
  size = 16,
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ fill: "none" }}
  >
    {children}
  </svg>
)

type IconProps = { size?: number }

export const XIcon: React.FC<IconProps> = ({ size }) => (
  <Stroke size={size}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Stroke>
)

export const PlusIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <Stroke size={size}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
)

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 12 }) => (
  <Stroke size={size}>
    <path d="m18 15-6-6-6 6" />
  </Stroke>
)

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 12 }) => (
  <Stroke size={size}>
    <path d="m6 9 6 6 6-6" />
  </Stroke>
)

export const TrashIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <Stroke size={size}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </Stroke>
)

/** Row options (flags, default, colors, parameters, code). */
export const SlidersIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <Stroke size={size}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" />
  </Stroke>
)

export const PaletteIcon: React.FC<IconProps> = ({ size = 16 }) => (
  <Stroke size={size}>
    <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22Z" />
    <circle cx="7.5" cy="10.5" r="1" />
    <circle cx="10.5" cy="6.5" r="1" />
    <circle cx="15.5" cy="6.5" r="1" />
  </Stroke>
)

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <Stroke size={size}>
    <path d="m9 18 6-6-6-6" />
  </Stroke>
)

export const CodeIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <Stroke size={size}>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </Stroke>
)
