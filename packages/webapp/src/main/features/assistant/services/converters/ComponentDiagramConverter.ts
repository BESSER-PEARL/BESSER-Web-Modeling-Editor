/**
 * Component Diagram Converter
 * Converts a simplified ComponentDiagram spec emitted by the modeling agent
 * into the Apollon ComponentDiagram model.
 *
 * Elements: Subsystem (container), Component.
 * Relationships: ComponentDependency.
 * Layout: subsystems are placed in a grid left-to-right;
 *         components inside subsystems are placed below their subsystem label.
 */

import { DiagramConverter, generateUniqueId } from './base';

const SUBSYSTEM_W = 300;
const SUBSYSTEM_H_MIN = 160;
const COMPONENT_W = 160;
const COMPONENT_H = 80;
const COMPONENT_GAP = 20;
const SUBSYSTEM_GAP_X = 60;
const SUBSYSTEM_PADDING = 30;
const TOP_PADDING = 40;

export class ComponentDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'ComponentDiagram' as const;
  }

  convertSingleElement(spec: any) {
    const name = spec?.name || spec?.elementName || 'Component';
    return this.convertCompleteSystem({
      systemName: name,
      subsystems: [],
      components: [{ id: 'comp1', name, owner: null, stereotype: spec?.stereotype || 'solution' }],
      dependencies: [],
    });
  }

  convertCompleteSystem(systemSpec: any) {
    const subsystems: any[] = Array.isArray(systemSpec?.subsystems) ? systemSpec.subsystems : [];
    const components: any[] = Array.isArray(systemSpec?.components) ? systemSpec.components : [];
    const deps: any[] = Array.isArray(systemSpec?.dependencies) ? systemSpec.dependencies : [];

    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    // Map spec id → apollon id
    const idMap: Record<string, string> = {};

    // ── 1. Place subsystems left-to-right ──────────────────────────────
    // First compute how many components each subsystem has (for height)
    const subComps: Record<string, any[]> = {};
    subsystems.forEach((s) => { subComps[s.id] = []; });
    components.forEach((c) => {
      if (c.owner && subComps[c.owner] !== undefined) {
        subComps[c.owner].push(c);
      }
    });

    let curX = 0;
    const subBounds: Record<string, { x: number; y: number; width: number; height: number }> = {};

    subsystems.forEach((sub) => {
      const compCount = subComps[sub.id]?.length || 0;
      const height = Math.max(
        SUBSYSTEM_H_MIN,
        TOP_PADDING + compCount * (COMPONENT_H + COMPONENT_GAP) + SUBSYSTEM_PADDING,
      );
      const width = SUBSYSTEM_W;
      const apollonId = generateUniqueId('sub');
      idMap[sub.id] = apollonId;
      subBounds[sub.id] = { x: curX, y: 0, width, height };
      elements[apollonId] = {
        id: apollonId,
        name: typeof sub.name === 'string' ? sub.name : '',
        type: 'Subsystem',
        owner: sub.owner && idMap[sub.owner] ? idMap[sub.owner] : null,
        bounds: { x: curX, y: 0, width, height },
        stereotype: 'subsystem',
        displayStereotype: true,
      };
      curX += width + SUBSYSTEM_GAP_X;
    });

    // ── 2. Place components ────────────────────────────────────────────
    // Track how many components placed per subsystem for vertical stacking
    const subCompCursor: Record<string, number> = {};
    let floatingX = curX;  // for top-level components (no owner)

    components.forEach((comp) => {
      const apollonId = generateUniqueId('comp');
      idMap[comp.id] = apollonId;

      let x = 0, y = 0, owner: string | null = null;
      if (comp.owner && idMap[comp.owner]) {
        owner = idMap[comp.owner];
        const sb = subBounds[comp.owner];
        const idx = subCompCursor[comp.owner] || 0;
        x = (sb?.x || 0) + SUBSYSTEM_PADDING;
        y = (sb?.y || 0) + TOP_PADDING + idx * (COMPONENT_H + COMPONENT_GAP);
        subCompCursor[comp.owner] = idx + 1;
      } else {
        // No owner — place to the right of subsystems
        x = floatingX;
        y = 0;
        floatingX += COMPONENT_W + COMPONENT_GAP;
      }

      elements[apollonId] = {
        id: apollonId,
        name: typeof comp.name === 'string' ? comp.name : '',
        type: 'Component',
        owner,
        bounds: { x, y, width: COMPONENT_W, height: COMPONENT_H },
        stereotype: comp.stereotype || 'solution',
        displayStereotype: true,
        realizes: [],
        processModelRefs: [],
      };
    });

    // ── 3. Dependencies ────────────────────────────────────────────────
    deps.forEach((dep) => {
      const srcId = idMap[String(dep.source)];
      const tgtId = idMap[String(dep.target)];
      if (!srcId || !tgtId) return;
      const relId = generateUniqueId('cdep');
      relationships[relId] = {
        id: relId,
        name: '',
        type: 'ComponentDependency',
        owner: null,
        bounds: { x: 0, y: 0, width: 100, height: 1 },
        path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        source: { element: srcId, direction: 'Right' },
        target: { element: tgtId, direction: 'Left' },
        isManuallyLayouted: false,
        stereotype: dep.stereotype || 'uses',
      };
    });

    // ── 4. Centre on origin ────────────────────────────────────────────
    const placed = Object.values(elements);
    if (placed.length) {
      const minX = Math.min(...placed.map((e) => e.bounds.x));
      const minY = Math.min(...placed.map((e) => e.bounds.y));
      const maxX = Math.max(...placed.map((e) => e.bounds.x + e.bounds.width));
      const maxY = Math.max(...placed.map((e) => e.bounds.y + e.bounds.height));
      const offsetX = -(minX + maxX) / 2;
      const offsetY = -(minY + maxY) / 2;
      placed.forEach((e) => {
        e.bounds.x += offsetX;
        e.bounds.y += offsetY;
      });
    }

    const allBounds = Object.values(elements).map((e) => e.bounds);
    const totalW = allBounds.length
      ? Math.max(...allBounds.map((b) => b.x + b.width)) - Math.min(...allBounds.map((b) => b.x))
      : 800;
    const totalH = allBounds.length
      ? Math.max(...allBounds.map((b) => b.y + b.height)) - Math.min(...allBounds.map((b) => b.y))
      : 400;

    return {
      version: '3.0.0',
      type: 'ComponentDiagram',
      size: { width: Math.max(600, totalW + 80), height: Math.max(300, totalH + 80) },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }
}
