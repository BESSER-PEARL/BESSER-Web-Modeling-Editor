import { describe, it, expect } from 'vitest';
import { attributeIconService } from '../attributeIconService';

describe('AttributeIconService', () => {
  it('should return unset icon when value is undefined', () => {
    const icon = attributeIconService.getIconName('Personal_Information', 'gender', undefined);
    expect(icon).toBe('HelpCircle');
  });

  it('should return Male icon for Male value', () => {
    const icon = attributeIconService.getIconName('Personal_Information', 'gender', 'Male');
    expect(icon).toBe('User');
  });

  it('should return Female icon for Female value', () => {
    const icon = attributeIconService.getIconName('Personal_Information', 'gender', 'Female');
    expect(icon).toBe('User');
  });

  it('should return Other icon for Other value', () => {
    const icon = attributeIconService.getIconName('Personal_Information', 'gender', 'Other');
    expect(icon).toBe('User');
  });

  it('should identify configured containers', () => {
    const isCollapsible = attributeIconService.isCollapsibleContainer('Personal_Information');
    expect(isCollapsible).toBe(true);
  });

  it('should get configured attributes for container', () => {
    const attrs = attributeIconService.getConfiguredAttributesForContainer('Personal_Information');
    expect(attrs.length).toBeGreaterThan(0);
    expect(attrs.some((a) => a.attribute === 'gender')).toBe(true);
  });

  it('should return mapping for configured attribute', () => {
    const mapping = attributeIconService.getMapping('Personal_Information', 'gender');
    expect(mapping).not.toBeNull();
    expect(mapping?.displayName).toBe('Gender');
  });

  it('should return null for non-configured attribute', () => {
    const mapping = attributeIconService.getMapping('NonExistent', 'attr');
    expect(mapping).toBeNull();
  });
});
