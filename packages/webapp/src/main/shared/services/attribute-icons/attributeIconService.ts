import attributeIconsConfig from '../../constants/attribute-icons.json';

export interface AttributeIconMapping {
  type: 'enum' | 'static';
  containerClass: string;
  attribute: string;
  icons: Record<string, string>;
  displayName: string;
}

export type AttributeIconConfig = Record<string, AttributeIconMapping>;

class AttributeIconService {
  private config: AttributeIconConfig;

  constructor() {
    this.config = attributeIconsConfig as unknown as AttributeIconConfig;
  }

  /**
   * Get icon name for an attribute and value.
   * @param containerClass e.g. "Personal_Information"
   * @param attribute e.g. "gender"
   * @param value e.g. "Male", or undefined for unset
   * @returns Lucide icon name, e.g. "User", "HelpCircle"
   */
  getIconName(containerClass: string, attribute: string, value?: string): string {
    const key = `${containerClass}.${attribute}`;
    const mapping = this.config[key];
    if (!mapping) return 'HelpCircle';

    const icons = mapping.icons;
    if (!value || value === '') return icons.unset || 'HelpCircle';
    return icons[value] || icons.unset || 'HelpCircle';
  }

  /**
   * Check if an attribute has a dynamic icon config.
   */
  hasIconConfig(containerClass: string, attribute: string): boolean {
    const key = `${containerClass}.${attribute}`;
    return key in this.config;
  }

  /**
   * Get the full mapping for an attribute (if configured).
   */
  getMapping(containerClass: string, attribute: string): AttributeIconMapping | null {
    const key = `${containerClass}.${attribute}`;
    return this.config[key] || null;
  }

  /**
   * Get all configured attribute keys.
   */
  getAllConfiguredKeys(): string[] {
    return Object.keys(this.config);
  }

  /**
   * Get all configured container classes.
   */
  getConfiguredContainers(): Set<string> {
    const containers = new Set<string>();
    Object.values(this.config).forEach((mapping) => {
      containers.add(mapping.containerClass);
    });
    return containers;
  }

  /**
   * Check if a container class should be collapsed (all its configured attributes are in the config).
   * For now, we use a simple heuristic: if at least one attribute is configured, treat it as collapsible.
   * (Phase 3a will refine this to handle partial coverage.)
   */
  isCollapsibleContainer(containerClass: string): boolean {
    const configured = this.getAllConfiguredKeys();
    return configured.some((key) => key.startsWith(`${containerClass}.`));
  }

  /**
   * Get all attributes of a container that have icon configs.
   */
  getConfiguredAttributesForContainer(containerClass: string): AttributeIconMapping[] {
    return Object.values(this.config).filter((m) => m.containerClass === containerClass);
  }
}

export const attributeIconService = new AttributeIconService();
