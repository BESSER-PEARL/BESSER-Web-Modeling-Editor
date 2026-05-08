import { createTheme, type Theme } from "@mui/material/styles"

/**
 * SA-PANEL-STYLE: MUI theme override that harmonises the inspector look
 * with the webapp's Tailwind/Radix design tokens (`packages/webapp/src/
 * components/ui/`).
 *
 * Approach B (style harmonization): keep MUI components but map their
 * spacing, radius, font, and colors to match Tailwind primitives so the
 * properties panel doesn't visually clash with the rest of the webapp.
 *
 * Tokens mirrored from `packages/webapp/src/components/ui/{input,select,
 * button}.tsx` and `tailwind.config.ts`:
 *
 * | Tailwind class | Reproduced as |
 * | --------------- | -------------- |
 * | `text-sm`       | 13px font size |
 * | `rounded-md`    | 6px borderRadius |
 * | `border-input`  | 1px solid var(--besser-gray) |
 * | `focus:ring-2 focus:ring-ring/20` | subtle blue glow on focus |
 * | `h-10` (inputs) | 36px control height (slightly tighter than 40px) |
 * | `px-3 py-2`     | matched via component overrides |
 *
 * Applied via a single `<ThemeProvider theme={inspectorTheme}>` in
 * `PropertiesPanel.tsx`. The base WME canvas is intentionally NOT wrapped
 * — only the inspector panel needs the Tailwind-aligned styling.
 */
export const inspectorTheme: Theme = createTheme({
  // SA-PANEL-STYLE: align border radius with Tailwind `rounded-md` (6px,
  // i.e. `--radius - 2px` from the webapp's `:root` where `--radius =
  // 0.85rem ≈ 13.6px`; we use the more conservative shadcn convention).
  shape: {
    borderRadius: 6,
  },
  typography: {
    // SA-PANEL-STYLE: switch to the webapp's preferred sans stack so the
    // panel inherits the same letterforms Tailwind uses everywhere else.
    fontFamily:
      'var(--font-geist-sans, "Sora"), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    // Tailwind `text-sm` is 14px / 1.25rem; inspector controls are dense
    // so we go one notch tighter (13px).
    fontSize: 13,
    body1: { fontSize: "0.8125rem" },
    body2: { fontSize: "0.75rem" },
    button: { textTransform: "none", fontWeight: 500 },
  },
  palette: {
    // Pull from the existing CSS variables so the panel adapts to the
    // webapp's light/dark theme without any explicit mode switch.
    primary: {
      main: "var(--besser-primary, #2a8fbd)" as unknown as string,
    },
    text: {
      primary: "var(--besser-primary-contrast, #0f172a)" as unknown as string,
      secondary:
        "var(--besser-gray-variant, #495057)" as unknown as string,
    },
    background: {
      paper: "var(--besser-background, #ffffff)" as unknown as string,
      default: "var(--besser-background, #ffffff)" as unknown as string,
    },
    divider: "var(--besser-gray, #e9ecef)" as unknown as string,
  },
  components: {
    // ---- Inputs --------------------------------------------------------
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: "0.8125rem",
          backgroundColor: "var(--besser-background, #ffffff)",
          // Match webapp `border-input` (1px solid hsl(var(--input))).
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--besser-gray, #e9ecef)",
            borderWidth: "1px",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--besser-gray-variant, #adb5bd)",
          },
          // Tailwind: focus-visible:ring-2 ring-ring/20 — translate to a
          // subtle 2px primary-tinted glow plus a primary border.
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--besser-primary, #2a8fbd)",
            borderWidth: "1px",
            boxShadow: "0 0 0 2px rgba(42, 143, 189, 0.2)",
          },
        },
        input: {
          padding: "8px 12px",
          fontSize: "0.8125rem",
          color: "var(--besser-primary-contrast, #0f172a)",
        },
        sizeSmall: {
          fontSize: "0.8125rem",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: "0.8125rem",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: "0.8125rem",
          color: "var(--besser-gray-variant, #495057)",
          "&.Mui-focused": {
            color: "var(--besser-primary, #2a8fbd)",
          },
        },
        sizeSmall: { fontSize: "0.8125rem" },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", variant: "outlined" },
    },
    MuiFormControl: {
      defaultProps: { size: "small" },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: "0.7rem", marginTop: 2 },
      },
    },

    // ---- Select --------------------------------------------------------
    MuiSelect: {
      defaultProps: { size: "small" },
      styleOverrides: {
        select: {
          padding: "8px 12px",
          fontSize: "0.8125rem",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.8125rem",
          paddingTop: 6,
          paddingBottom: 6,
          // Tailwind `focus:bg-accent` analogue — soft background on hover.
          "&:hover": {
            backgroundColor:
              "color-mix(in srgb, var(--besser-primary, #2a8fbd) 8%, transparent)",
          },
          "&.Mui-selected": {
            backgroundColor:
              "color-mix(in srgb, var(--besser-primary, #2a8fbd) 14%, transparent)",
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 6,
          border: "1px solid var(--besser-gray, #e9ecef)",
          boxShadow:
            "0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -2px rgba(0, 0, 0, 0.04)",
        },
      },
    },

    // ---- Buttons -------------------------------------------------------
    MuiButton: {
      defaultProps: { disableElevation: true, size: "small" },
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: "none",
          fontSize: "0.8125rem",
          fontWeight: 500,
          padding: "6px 12px",
        },
        outlined: {
          borderColor: "var(--besser-gray, #e9ecef)",
          color: "var(--besser-primary-contrast, #0f172a)",
          "&:hover": {
            borderColor: "var(--besser-gray-variant, #adb5bd)",
            backgroundColor:
              "color-mix(in srgb, var(--besser-primary, #2a8fbd) 6%, transparent)",
          },
        },
      },
    },
    MuiIconButton: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: 4,
          "&:hover": {
            backgroundColor:
              "color-mix(in srgb, var(--besser-primary, #2a8fbd) 8%, transparent)",
          },
        },
      },
    },

    // ---- Checkbox / Radio ---------------------------------------------
    MuiCheckbox: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          padding: 4,
          color: "var(--besser-gray-variant, #6b7280)",
          "&.Mui-checked": {
            // Match Tailwind `accent-primary` — solid primary color, no
            // purple MUI default.
            color: "var(--besser-primary, #2a8fbd)",
          },
        },
      },
    },
    MuiRadio: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          padding: 4,
          color: "var(--besser-gray-variant, #6b7280)",
          "&.Mui-checked": {
            color: "var(--besser-primary, #2a8fbd)",
          },
        },
      },
    },
    MuiSwitch: {
      defaultProps: { size: "small" },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontSize: "0.8125rem",
          color: "var(--besser-primary-contrast, #0f172a)",
        },
      },
    },

    // ---- Tooltip / Chip / Divider -------------------------------------
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: "0.7rem",
          backgroundColor:
            "var(--besser-primary-contrast, #0f172a)",
          borderRadius: 4,
          padding: "4px 8px",
        },
        arrow: {
          color: "var(--besser-primary-contrast, #0f172a)",
        },
      },
    },
    MuiChip: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontSize: "0.7rem",
          height: 22,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "var(--besser-gray, #e9ecef)",
        },
      },
    },

    // ---- Containers / Stacks -----------------------------------------
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "var(--besser-background, #ffffff)",
        },
      },
    },
    MuiStack: {
      defaultProps: {
        // Slightly tighter default gap — most inspector rows want 8px,
        // not the MUI default 16px.
        spacing: 1,
      },
    },
    MuiList: {
      styleOverrides: {
        root: { paddingTop: 4, paddingBottom: 4 },
      },
    },
  },
})
