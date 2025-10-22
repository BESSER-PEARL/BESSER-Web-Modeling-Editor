import { Selection } from '@besser/wme';
import { SelectionChangeType } from 'shared';

export function selectionDiff(src: Selection, dest: Selection): SelectionChangeType {
  const selected = new Set<string>();
  const deselected = new Set<string>();

  const srcUnion = { ...src.elements, ...src.relationships };
  const destUnion = { ...dest.elements, ...dest.relationships };

  Object.entries(srcUnion).forEach(([id, isSelected]) => {
    if (isSelected && !destUnion[id]) {
      deselected.add(id);
    } else if (!isSelected && destUnion[id]) {
      selected.add(id);
    }
  });

  Object.entries(destUnion).forEach(([id, isSelected]) => {
    if (isSelected && !srcUnion[id]) {
      selected.add(id);
    } else if (!isSelected && srcUnion[id]) {
      deselected.add(id);
    }
  });

  return {
    selected: Array.from(selected),
    deselected: Array.from(deselected),
  };
}
