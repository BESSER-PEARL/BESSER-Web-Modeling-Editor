import { describe, expect, it } from 'vitest';

import en from '../../../../../../i18n/en/webapp.json';
import { ALL_DIAGRAM_TYPES } from '../../types/project';

/**
 * Places that list diagrams by type and look the label up by key. A type
 * missing from the map renders as its raw key (e.g. "export.diagramLabels.X"),
 * which is what happened to the Knowledge Graph after a merge dropped its
 * entry from the Export dialog.
 */
describe('a label exists for every diagram type', () => {
  it('in the Export dialog', () => {
    const labels = en.export.diagramLabels as Record<string, string>;

    for (const type of ALL_DIAGRAM_TYPES) {
      expect(labels[type], `export.diagramLabels.${type}`).toEqual(expect.any(String));
    }
  });

  it('in the diagram-type display names', () => {
    const names = (en as { diagramTypes?: Record<string, string> }).diagramTypes ?? {};
    const missing = ALL_DIAGRAM_TYPES.filter((type) => !names[type]);

    expect(missing).toEqual([]);
  });
});
