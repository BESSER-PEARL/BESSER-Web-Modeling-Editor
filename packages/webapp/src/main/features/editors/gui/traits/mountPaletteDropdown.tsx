import React from 'react';
import { createRoot } from 'react-dom/client';
import { PaletteDropdown } from './PaletteDropdown';

// Helper to mount a React component into a DOM node
interface MountPaletteDropdownArgs {
  container: HTMLElement;
  palettes: string[][];
  value: number;
  onChange: (paletteIndex: number) => void;
}

export function mountPaletteDropdown({
  container,
  palettes,
  value,
  onChange,
}: MountPaletteDropdownArgs) {
  const root = createRoot(container);
  root.render(
    <PaletteDropdown palettes={palettes} value={value} onChange={onChange} />
  );
  return root;
}
