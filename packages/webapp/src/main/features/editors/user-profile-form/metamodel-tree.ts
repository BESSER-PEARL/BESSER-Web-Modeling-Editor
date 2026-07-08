/**
 * Derives the User Profile part-hierarchy generically from the fixed metamodel
 * exposed by `diagramBridge`. The form UI and the (de)serialisers are driven
 * entirely by this tree, so changes to the metamodel flow through automatically.
 *
 * The metamodel is a ClassDiagram whose relationships encode containment via
 * multiplicities, e.g.:
 *
 *   User(1..1)         --> Accessibility(0..1)      // single part
 *   Accessibility(1..1)--> Disability(0..*)         // repeatable part
 *   Competence(1..1)   --> Skill(0..*)              // repeatable part
 *
 * Rule: the relationship end whose multiplicity starts with `1` is the
 * container (parent); the other end is the child part, which is `multiple`
 * when its multiplicity ends with `*`, otherwise `single`.
 */

import { diagramBridge } from '@besser/wme';
// The fixed user metamodel is a static JSON shipped with the editor package.
// Importing it here makes the form fully self-sufficient (frontend only): it
// never has to wait for navigation to populate the bridge, and never calls
// the backend.
import userMetaModel from '../../../../../../editor/src/main/packages/user-modeling/usermetamodel_buml_short.json';

export interface MetaAttr {
  id: string;
  name: string;
  type: string;
  /** Allowed literal values when `type` is an enumeration; undefined otherwise. */
  enumValues?: string[];
}

export type Multiplicity = 'single' | 'multiple';

export interface MetaChildRef {
  className: string;
  classId: string;
  multiplicity: Multiplicity;
}

export interface MetaNode {
  className: string;
  classId: string;
  icon?: string;
  attributes: MetaAttr[];
  children: MetaChildRef[];
}

export interface MetaTree {
  /** The `User` node, or null if the metamodel is unavailable. */
  root: MetaNode | null;
  /** Every metamodel class keyed by class name (for recursion / lookup). */
  byClassName: Record<string, MetaNode>;
}

export const ROOT_CLASS_NAME = 'User';

const isContainerMultiplicity = (m?: string): boolean =>
  typeof m === 'string' && m.trim().startsWith('1');

const isMany = (m?: string): boolean => typeof m === 'string' && m.trim().endsWith('*');

/**
 * Ensure the bridge holds the user metamodel. If navigation hasn't populated
 * it yet (or it holds some other class diagram), seed it from the bundled JSON
 * so the form — and the graphical palette — always have the metamodel. This is
 * a pure localStorage-backed operation (diagramBridge persists to localStorage);
 * no backend call is involved.
 */
const ensureMetamodelLoaded = (): void => {
  const current = diagramBridge.getClassDiagramData();
  const hasUser =
    !!current &&
    Object.values(current.elements || {}).some(
      (el: any) => (el?.type === 'Class' || el?.type === 'AbstractClass') && el?.name === ROOT_CLASS_NAME,
    );
  if (!hasUser) {
    try {
      diagramBridge.setClassDiagramData(userMetaModel as unknown as any);
    } catch {
      /* bridge unavailable — buildMetamodelTree will return an empty tree */
    }
  }
};

/**
 * Build the part-tree from the user metamodel. Falls back to the bundled JSON
 * when the bridge isn't populated, so it never returns an empty tree on a
 * genuine User Profile diagram.
 */
/**
 * Map every enumeration name to its ordered literal values, read from the
 * metamodel. Enumerations are elements of type `Enumeration` whose `attributes`
 * reference literal child elements (their `name` is the literal value).
 */
const buildEnumValueMap = (data: { elements?: Record<string, any> } | null): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  const elements = data?.elements || {};
  Object.values(elements).forEach((el: any) => {
    if (el?.type !== 'Enumeration' || !el.name) return;
    map[el.name] = (el.attributes || [])
      .map((litId: string) => elements[litId]?.name)
      .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0);
  });
  return map;
};

export const buildMetamodelTree = (): MetaTree => {
  ensureMetamodelLoaded();
  const classes = diagramBridge.getAvailableClasses();
  const data = diagramBridge.getClassDiagramData();
  const enumValues = buildEnumValueMap(data);

  const byId: Record<string, MetaNode> = {};
  const byClassName: Record<string, MetaNode> = {};

  classes.forEach((cls) => {
    const node: MetaNode = {
      className: cls.name,
      classId: cls.id,
      icon: cls.icon,
      attributes: (cls.attributes || []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type || 'str',
        enumValues: a.type && enumValues[a.type] ? enumValues[a.type] : undefined,
      })),
      children: [],
    };
    byId[cls.id] = node;
    byClassName[cls.name] = node;
  });

  const relationships = (data?.relationships || {}) as Record<string, any>;

  Object.values(relationships).forEach((rel: any) => {
    if (!rel || rel.type === 'ClassInheritance' || rel.type === 'ClassRealization') return;
    const srcId = rel.source?.element;
    const tgtId = rel.target?.element;
    if (!srcId || !tgtId) return;

    const srcNode = byId[srcId];
    const tgtNode = byId[tgtId];
    // Skip relationships that touch endpoints which are not selectable classes
    // (e.g. helper classes absent from the palette).
    if (!srcNode || !tgtNode) return;

    const srcMult = rel.source?.multiplicity;
    const tgtMult = rel.target?.multiplicity;

    let parent: MetaNode;
    let child: MetaNode;
    let childMult: string | undefined;

    if (isContainerMultiplicity(srcMult) && !isContainerMultiplicity(tgtMult)) {
      parent = srcNode;
      child = tgtNode;
      childMult = tgtMult;
    } else if (isContainerMultiplicity(tgtMult) && !isContainerMultiplicity(srcMult)) {
      parent = tgtNode;
      child = srcNode;
      childMult = srcMult;
    } else {
      // Ambiguous (both or neither are containers): default to source -> target.
      parent = srcNode;
      child = tgtNode;
      childMult = tgtMult;
    }

    if (parent.classId === child.classId) return;
    if (parent.children.some((c) => c.classId === child.classId)) return;

    parent.children.push({
      className: child.className,
      classId: child.classId,
      multiplicity: isMany(childMult) ? 'multiple' : 'single',
    });
  });

  return { root: byClassName[ROOT_CLASS_NAME] || null, byClassName };
};
