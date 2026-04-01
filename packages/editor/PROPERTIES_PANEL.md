# Properties Panel vs Legacy Popover

The editor supports two modes for element editing UI:

- **Properties Panel** (default) — Right-side overlay panel, similar to Figma/draw.io
- **Legacy Popover** — Floating popup positioned next to the element on the canvas

## How to switch

In `src/main/scenes/application.tsx`, change the flag at the top of the file:

```typescript
// New right-side panel (default)
const USE_PROPERTIES_PANEL = true;

// Legacy floating popover
const USE_PROPERTIES_PANEL = false;
```

That's it. Both implementations read from the same `Popups` registry (`packages/popups.ts`) and reuse the same 52 update components. No other changes needed.

## Architecture

```
packages/popups.ts          ← Central registry (shared by both)
├── PropertiesPanel         ← New: right-side overlay panel
│   ├── properties-panel.tsx
│   └── properties-panel-styles.ts
└── UpdatePane              ← Legacy: floating popover
    ├── update-pane.tsx
    └── versions/
```

Both components:
1. Read `state.updating[0]` from Redux to get the element being edited
2. Look up `Popups[element.type]` to get the correct form component
3. Render `<CustomPopupComponent element={element} />`

The only difference is the container — sidebar vs floating popover.
