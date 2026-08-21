# Console Warnings Fix — Editor Package

## Summary

Two rounds of fixes were applied to the `packages/editor` source to eliminate
styled-components and React DOM prop-forwarding warnings that cluttered the
browser console during development.

---

## Round 1 — Bulk fixes

### 1. Themed SVG components (`themedComponents.ts`)

**Problem:** Every `ThemedRect`, `ThemedPath`, `ThemedCircle`, etc. forwarded
the custom props `fillColor` and `strokeColor` straight to the SVG DOM, which
React does not recognise.

**Fix:** Added a shared `shouldForwardProp` guard to all nine themed components
and removed the redundant re-assignment of `fillColor`/`strokeColor` inside
`.attrs()` (only the standard `fill`/`stroke` attributes need to reach the DOM).

### 2. Textfield (`textfield-styled.ts`)

**Problem:** `StyledTextfield` forwarded `block`, `gutter`, `multiline`,
`outline`, `readonly`, and `enterToSubmit` to the underlying `<input>` /
`<textarea>`.

**Fix:** Added `.withConfig({ shouldForwardProp })` that filters out those six
props before they reach the DOM.

### 3. Popover (`popover-styles.ts`)

**Problem:** `PopoverContainer` forwarded `placement`, `alignment`, `position`,
and `maxHeight` to a `<div>`. `PopoverBody` forwarded `maxHeight`. `Arrow`
forwarded `placement` and `alignment`.

**Fix:** Added `.withConfig({ shouldForwardProp })` to all three components.

### 4. Editor canvas (`editor.tsx`)

**Problem:** `EditorComponent` destructured only `moving`, `connecting`,
`reconnecting`, and `scale` from props and spread the rest (`...props`) onto
`StyledEditor`. This leaked the Redux dispatch props `move` and `setZoomFactor`
to the DOM `<div>`.

**Fix:** Destructured `move` and `setZoomFactor` alongside the other known
props so they are excluded from `...props`.

### 5. Object-name component (`uml-object-name-component.tsx`)

**Problem:** Used the HTML-style attribute `pointer-events="none"` on a
`ThemedRect` inside JSX. React expects the camelCase form.

**Fix:** Changed to `pointerEvents="none"` in both `renderIconView` and
`renderNormalView`.

---

## Round 2 — Remaining warnings

### 6. Canvas container (`canvas-styles.ts`)

**Problem:** `CanvasContainer` (a `styled.svg`) received an `isStatic` boolean
prop that was forwarded to the SVG DOM element, triggering a React warning.

**Fix:** Added `.withConfig({ shouldForwardProp })` to filter out `isStatic`.
The prop is still available inside the styled interpolation for CSS logic.

### 7. Classifier component (`uml-classifier-component.tsx`)

**Problem:** Same `pointer-events` vs `pointerEvents` issue as the object-name
component (Round 1, item 5), but in the class/classifier renderer.

**Fix:** Changed `pointer-events="none"` to `pointerEvents="none"`.

---

## Round 3 — Update-pane warnings

### 8. Button (`button-styles.ts`)

**Problem:** `StyledButton` forwarded the custom props `block` and `outline` to
the DOM `<button>`. These control styling logic (full-width layout and outline
variant) but are not valid HTML button attributes.

**Fix:** Added `.withConfig({ shouldForwardProp })` to `StyledButton` that
filters out `block` and `outline` before they reach the DOM.

### 9. Typography / Header (`typography-styles.ts`)

**Problem:** The `Typography` styled component (rendered as `<h1>` via the
`Header` wrapper in `typography.tsx`) forwarded `variant` and `gutter` to the
DOM element. These props drive header/body sizing and margin logic in CSS-in-JS
but are not valid HTML attributes.

**Fix:** Added `.withConfig({ shouldForwardProp })` to `Typography` that filters
out `variant` and `gutter`.

---

## Result

After all three rounds, the browser console is free of styled-components
`shouldForwardProp` warnings and React "unknown DOM prop" warnings originating
from the editor package. The only remaining console output consists of:

- **React Router future-flag notices** — upstream library warnings; require a
  React Router v7 upgrade to resolve.
- **Cookie warnings** — browser-level, unrelated to application code.
