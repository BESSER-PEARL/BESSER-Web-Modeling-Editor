/**
 * GUI (No-Code) Diagram Converter
 * Converts simplified GUI component specifications to Apollon-compatible format.
 *
 * GUINoCodeDiagram elements represent visual UI components (pages, sections,
 * buttons, inputs, etc.) that the GrapesJS-based editor can consume.  The
 * converter maps a declarative component tree into flat positioned elements.
 */

import { DiagramConverter, DiagramPosition, PositionGenerator, generateUniqueId } from './base';

interface GUIComponentSpec {
  componentName: string;
  componentType: 'Page' | 'Section' | 'Button' | 'Input' | 'Text' | 'Image' | 'Form' | 'NavBar' | 'Card' | string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  /** Text / label displayed on the component */
  label?: string;
  /** Child component specs */
  children?: GUIComponentSpec[];
  /** Arbitrary style / props */
  props?: Record<string, unknown>;
}

interface GUISystemSpec {
  appName?: string;
  pages?: Array<{
    pageName: string;
    route?: string;
    components?: GUIComponentSpec[];
  }>;
  /** Flat component list (alternative to pages) */
  components?: GUIComponentSpec[];
}

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  Page: { width: 800, height: 600 },
  Section: { width: 700, height: 200 },
  NavBar: { width: 800, height: 60 },
  Card: { width: 300, height: 200 },
  Form: { width: 400, height: 300 },
  Button: { width: 120, height: 40 },
  Input: { width: 260, height: 40 },
  Text: { width: 200, height: 30 },
  Image: { width: 200, height: 150 },
};

const PAGE_SPACING = 900;

export class GUIDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'GUINoCodeDiagram' as const;
  }

  /**
   * Convert a single GUI component spec into editor elements.
   */
  convertSingleElement(spec: any, position?: DiagramPosition) {
    const pos = position || this.positionGenerator.getNextPosition();
    const compSpec = spec as Partial<GUIComponentSpec>;
    const compType = compSpec.componentType || 'Section';
    const size = compSpec.size || DEFAULT_SIZES[compType] || { width: 200, height: 100 };

    const elementId = generateUniqueId('gui');
    const element: Record<string, any> = {
      id: elementId,
      name: compSpec.componentName || compSpec.label || compType,
      type: `GUI${compType}`,
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: size.width, height: size.height },
      label: compSpec.label || compSpec.componentName || '',
      props: compSpec.props || {},
    };

    const result: { state: any; bodies?: Record<string, any> } = { state: element };

    // Flatten children into body elements owned by the parent
    if (compSpec.children?.length) {
      const bodies: Record<string, any> = {};
      let offsetY = pos.y + 50;
      compSpec.children.forEach((child) => {
        const childId = generateUniqueId('gui_child');
        const childType = child.componentType || 'Text';
        const childSize = child.size || DEFAULT_SIZES[childType] || { width: 180, height: 30 };
        bodies[childId] = {
          id: childId,
          name: child.componentName || child.label || childType,
          type: `GUI${childType}`,
          owner: elementId,
          bounds: { x: pos.x + 10, y: offsetY, width: childSize.width, height: childSize.height },
          label: child.label || child.componentName || '',
          props: child.props || {},
        };
        offsetY += childSize.height + 10;
      });
      result.bodies = bodies;
    }

    return result;
  }

  /**
   * Convert a full GUI application specification (pages → components) into
   * the editor element map.
   */
  convertCompleteSystem(spec: any) {
    const guiSpec = spec as Partial<GUISystemSpec>;
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};

    const pages = guiSpec.pages ?? [];
    const flatComponents = guiSpec.components ?? [];

    let pageIndex = 0;

    // Process pages
    pages.forEach((page) => {
      const pageId = generateUniqueId('page');
      const pageX = pageIndex * PAGE_SPACING;
      const pageY = 0;

      elements[pageId] = {
        id: pageId,
        name: page.pageName,
        type: 'GUIPage',
        owner: null,
        bounds: { x: pageX, y: pageY, width: 800, height: 600 },
        route: page.route || `/${page.pageName.toLowerCase().replace(/\s+/g, '-')}`,
      };

      // Place child components inside the page
      let offsetY = pageY + 70;
      (page.components ?? []).forEach((comp) => {
        const compType = comp.componentType || 'Section';
        const size = comp.size || DEFAULT_SIZES[compType] || { width: 700, height: 100 };
        const compId = generateUniqueId('gui');
        elements[compId] = {
          id: compId,
          name: comp.componentName || comp.label || compType,
          type: `GUI${compType}`,
          owner: pageId,
          bounds: { x: pageX + 50, y: offsetY, width: size.width, height: size.height },
          label: comp.label || comp.componentName || '',
          props: comp.props || {},
        };
        offsetY += size.height + 15;

        // Nested children
        (comp.children ?? []).forEach((child) => {
          const childType = child.componentType || 'Text';
          const childSize = child.size || DEFAULT_SIZES[childType] || { width: 180, height: 30 };
          const childId = generateUniqueId('gui_child');
          elements[childId] = {
            id: childId,
            name: child.componentName || child.label || childType,
            type: `GUI${childType}`,
            owner: compId,
            bounds: { x: pageX + 60, y: offsetY, width: childSize.width, height: childSize.height },
            label: child.label || child.componentName || '',
            props: child.props || {},
          };
          offsetY += childSize.height + 8;
        });
      });

      pageIndex++;
    });

    // Process flat components (no page wrapper)
    flatComponents.forEach((comp, idx) => {
      const compType = comp.componentType || 'Section';
      const size = comp.size || DEFAULT_SIZES[compType] || { width: 300, height: 100 };
      const compId = generateUniqueId('gui');
      elements[compId] = {
        id: compId,
        name: comp.componentName || comp.label || compType,
        type: `GUI${compType}`,
        owner: null,
        bounds: { x: (idx % 3) * 350, y: Math.floor(idx / 3) * 250, width: size.width, height: size.height },
        label: comp.label || comp.componentName || '',
        props: comp.props || {},
      };
    });

    const totalWidth = Math.max(800, pageIndex * PAGE_SPACING);
    const totalHeight = Math.max(600, 800);

    return {
      elements,
      relationships,
      size: { width: totalWidth, height: totalHeight },
    };
  }
}
