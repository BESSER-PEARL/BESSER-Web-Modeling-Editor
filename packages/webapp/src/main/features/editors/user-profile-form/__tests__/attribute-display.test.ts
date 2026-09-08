import { describe, it, expect } from 'vitest';
import { UMLUserModelAttribute } from '../../../../../../../editor/src/main/packages/user-modeling/uml-user-model-attribute/uml-user-model-attribute';

describe('UMLUserModelAttribute display + round-trip', () => {
  it('renders the criterion verbatim (no visibility symbol / : type suffix), even after reload', () => {
    const attr = new UMLUserModelAttribute({ name: 'age = 25', attributeId: 'a1', attributeOperator: '>=' } as any);
    expect(attr.displayName).toBe('age = 25');

    // Simulate save -> reload: serialize writes attributeType='str', deserialize keeps it.
    const restored = new UMLUserModelAttribute();
    restored.deserialize(attr.serialize() as any);

    expect(restored.name).toBe('age = 25');
    // Regression: previously became "+ age = 25: str" once attributeType defaulted to 'str'.
    expect(restored.displayName).toBe('age = 25');
  });
});
