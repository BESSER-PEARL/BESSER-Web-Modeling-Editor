import lessShort from '../../../../main/packages/user-modeling/usermetamodel_buml_less_short.json';
import short from '../../../../main/packages/user-modeling/usermetamodel_buml_short.json';
import shortCorrected from '../../../../main/packages/user-modeling/usermetamodel_buml_short_corrected_format.json';
import { NAVIGABLE_ASSOCIATION_TYPES } from '../../../../main/packages/common/uml-association/uml-association-navigability';

// The bundled user metamodels must store associations in the canonical format:
// ClassBidirectional (never the legacy ClassUnidirectional) with an explicit
// boolean `navigable` on both ends, at least one end navigable, and the part
// (source) end of a composition navigable.
const metamodels: [string, any][] = [
  ['usermetamodel_buml_less_short.json', (lessShort as any).relationships],
  ['usermetamodel_buml_short.json', (short as any).relationships],
  ['usermetamodel_buml_short_corrected_format.json', (shortCorrected as any).model.relationships],
];

describe('user metamodel associations', () => {
  it.each(metamodels)('%s uses explicit per-end navigability', (_name, relationships) => {
    const associations = Object.values<any>(relationships).filter((r) => NAVIGABLE_ASSOCIATION_TYPES.includes(r.type));
    expect(associations.length).toBeGreaterThan(0);
    for (const rel of associations) {
      expect(rel.type).not.toBe('ClassUnidirectional');
      expect(typeof rel.source.navigable).toBe('boolean');
      expect(typeof rel.target.navigable).toBe('boolean');
      expect(rel.source.navigable || rel.target.navigable).toBe(true);
      if (rel.type === 'ClassComposition') expect(rel.source.navigable).toBe(true);
    }
  });
});
