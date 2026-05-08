const besserTheme = {
  color: {
    primary: "var(--besser-primary, #2a8fbd)",
    secondary: "var(--besser-secondary, #6c757d)",
    warningYellow: "var(--besser-warning-yellow, #ffc800)",
    background: "var(--besser-background, #ffffff)",
    backgroundVariant: "var(--besser-background-variant, #e5e5e5)",
    grid: "var(--besser-grid, rgba(36, 39, 36, 0.1))",
    primaryContrast: "var(--besser-primary-contrast, #000000)",
    gray: "var(--besser-gray, #e9ecef)",
    grayAccent: "var(--besser-gray-variant, #343a40)",
  },
  font: {
    color: "var(--besser-primary-contrast, #000000)",
    family: "Helvetica Neue, Helvetica, Arial, sans-serif",
    size: 16,
  },
  interactive: {
    normal: "rgba(0, 220, 0, 0.3)",
    hovered: "rgba(0, 220, 0, 0.15)",
  },
}

export const defaults = () => {
  return besserTheme
}
