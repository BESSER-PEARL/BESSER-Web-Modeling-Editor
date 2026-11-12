import { snapshotClassModel } from './classModelDiff';
import type { ClassModelLike } from './classModelDiff';
import { diffSnapshots, value } from './modelDiff';
import type { ElementChange, Snapshot } from './modelDiff';

/**
 * What changed between two versions of a GUI diagram (a GrapesJS project), element by element (compared in
 * `modelDiff.ts`), and which class-diagram elements each GUI element is bound to.
 *
 * Only the meaningful elements are traced: pages (B-UML `Screen`) and the components that show or edit data,
 * or act on it (tables, charts, metric cards, maps, agent components, forms, inputs, buttons, menus), and the
 * columns of a table; text, images and layout containers are not. A component is traced only when it has a persistent id
 * (`attributes.id`): without one the same component cannot be recognised from one save to the next (the GUI
 * editor gives one to every traced component); a column is known by its table and what it shows (its field, or
 * the label of an expression). Element types are the B-UML GUI metaclasses the backend's GUI processor builds
 * (`json_to_buml/gui_processors/processor.py`, `chart_parsers.py` for columns).
 */

export interface GuiComponentLike {
  type?: string;
  tagName?: string;
  name?: string;
  attributes?: Record<string, unknown>;
  components?: unknown;
  [field: string]: unknown;
}

export interface GuiPageLike {
  id?: string;
  name?: string;
  frames?: Array<{ component?: GuiComponentLike }>;
}

export interface GuiModelLike {
  pages?: GuiPageLike[];
}

/** GrapesJS component type -> B-UML metaclass, for the traced components. */
const COMPONENT_METACLASSES: Record<string, string> = {
  table: 'Table',
  'line-chart': 'LineChart',
  'bar-chart': 'BarChart',
  'pie-chart': 'PieChart',
  'radar-chart': 'RadarChart',
  'radial-bar-chart': 'RadialBarChart',
  'metric-card': 'MetricCard',
  map: 'Map',
  'agent-component': 'AgentComponent',
  form: 'Form',
  'gui-form': 'Form',
  button: 'Button',
  'action-button': 'Button',
  menu: 'Menu',
};
/** Plain HTML inputs, by component type or tag (the processor's `INPUT_COMPONENT_TYPES`). */
const INPUT_TYPES = new Set(['input', 'textarea', 'select', 'checkbox', 'radio']);
/** The attributes that name a component, in order of preference. */
const NAME_ATTRIBUTES = ['chart-title', 'metric-title', 'title', 'agent-title', 'button-label', 'field-name'];

/** A table column's `columnType` -> B-UML metaclass. */
const COLUMN_METACLASSES: Record<string, string> = {
  field: 'FieldColumn',
  lookup: 'LookupColumn',
  expression: 'ExpressionColumn',
};
const COLUMN_TYPES = new Set(Object.values(COLUMN_METACLASSES));

/** A class-diagram element a GUI element is bound to, as the GUI names it. */
interface Binding {
  /** An `association` is named by the role of the end a lookup column follows. */
  kind: 'class' | 'attribute' | 'method' | 'association';
  /** An id, or a name (the backend accepts either). */
  ref: string;
  /** The class an attribute or method named by name belongs to, or the class an association end starts from
   *  (a class id or name). */
  inClass?: string;
  /** The class an association end leads to (a lookup column's `lookupEntity`), when the role names none. */
  target?: string;
}

/** The attributes holding a binding, by what they name. */
const CLASS_ATTRIBUTES = ['data-source', 'target-entity', 'method-class', 'entity-class'];
const ATTRIBUTE_ATTRIBUTES = ['label-field', 'data-field', 'bind-to-property'];

function metaclassOf(component: GuiComponentLike): string | undefined {
  const type = typeof component.type === 'string' ? component.type : '';
  if (COMPONENT_METACLASSES[type]) return COMPONENT_METACLASSES[type];
  if (type.startsWith('gui-input-') || INPUT_TYPES.has(type)) return 'InputField';
  if (!type && typeof component.tagName === 'string' && INPUT_TYPES.has(component.tagName)) return 'InputField';
  return undefined;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A list stored as an array or as its JSON text. */
function listOf(raw: unknown): Record<string, unknown>[] {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? list.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
}

function bindingsOf(attributes: Record<string, unknown>): Binding[] {
  const bindings: Binding[] = [];
  const dataSource = text(attributes['data-source']) || text(attributes['target-entity']);
  for (const key of CLASS_ATTRIBUTES) {
    if (text(attributes[key])) bindings.push({ kind: 'class', ref: text(attributes[key]) });
  }
  for (const key of ATTRIBUTE_ATTRIBUTES) {
    if (text(attributes[key])) bindings.push({ kind: 'attribute', ref: text(attributes[key]), inClass: dataSource });
  }
  const methodClass = text(attributes['method-class']);
  if (text(attributes.method)) bindings.push({ kind: 'method', ref: text(attributes.method), inClass: methodClass });
  for (const series of listOf(attributes.series)) {
    const source = text(series['data-source']) || dataSource;
    if (text(series['data-source'])) bindings.push({ kind: 'class', ref: source });
    for (const key of ['label-field', 'data-field']) {
      if (text(series[key])) bindings.push({ kind: 'attribute', ref: text(series[key]), inClass: source });
    }
  }
  return bindings;
}

/** What a table column shows, as the backend's `parse_columns` reads it: a field column its attribute; a lookup
 *  column the association end it follows (its `field`, a role, else the class it leads to) and the attribute it
 *  displays of that class; an expression column nothing of the class diagram. */
function columnBindings(column: Record<string, unknown>, dataSource: string): Binding[] {
  const field = text(column.field).replace(/^\+\s*/, '');
  if (column.columnType === 'lookup') {
    const target = text(column.lookupEntity);
    return [
      ...(field || target ? [{ kind: 'association' as const, ref: field, inClass: dataSource, target }] : []),
      ...(text(column.lookupField) ? [{ kind: 'attribute' as const, ref: text(column.lookupField), inClass: target }] : []),
    ];
  }
  if (column.columnType === 'expression' || !field) return [];
  return [{ kind: 'attribute', ref: field, inClass: dataSource }];
}

/** A class-diagram element a GUI element is bound to, resolved in the class diagram. */
export interface BoundElement {
  elementId: string;
  elementType: string;
  name: string;
  /** Its owner (an attribute's or method's class), when it has one. */
  parent?: { elementId: string; elementType: string; name: string };
}

/** Resolves the bindings of a GUI against a class diagram (by id, else by name). */
class ClassIndex {
  private readonly snapshots: Map<string, Snapshot>;

  constructor(private readonly classModel: ClassModelLike | null | undefined) {
    this.snapshots = snapshotClassModel(classModel);
  }

  resolve(binding: Binding): BoundElement | undefined {
    if (binding.kind === 'association') {
      // An end the class diagram does not have still shows the class it leads to.
      return this.association(binding) ?? (binding.target ? this.resolve({ kind: 'class', ref: binding.target }) : undefined);
    }
    const wanted = binding.kind === 'class' ? ['Class', 'Enumeration'] : binding.kind === 'attribute' ? ['Property'] : ['Method'];
    const byId = this.snapshots.get(binding.ref);
    if (byId && wanted.includes(byId.elementType)) return this.bound(binding.ref);
    const classId = binding.inClass ? this.classId(binding.inClass) : undefined;
    for (const [id, found] of this.snapshots) {
      if (!wanted.includes(found.elementType)) continue;
      const name = found.elementType === 'Method' ? found.name.replace(/\(.*$/, '').trim() : found.name;
      if (name !== binding.ref) continue;
      if (binding.kind === 'class' || found.parentElementId === classId) return this.bound(id);
    }
    return undefined;
  }

  /** The association whose end, leaving `binding.inClass`, has the role `binding.ref` (a role left empty is
   *  the name of the class it leads to); else the only one leading to `binding.target`. */
  private association(binding: Binding): BoundElement | undefined {
    const from = binding.inClass ? this.classId(binding.inClass) : undefined;
    if (!from) return undefined;
    const to = binding.target ? this.classId(binding.target) : undefined;
    const leading: string[] = [];
    for (const relationship of Object.values(this.classModel?.relationships ?? {})) {
      if (this.snapshots.get(relationship.id)?.elementType !== 'BinaryAssociation') continue;
      for (const [own, other] of [[relationship.source, relationship.target], [relationship.target, relationship.source]]) {
        if (own?.element !== from || !other) continue;
        const role = text(other.role) || this.snapshots.get(other.element)?.name;
        if (binding.ref && role === binding.ref) return this.bound(relationship.id);
        if (other.element === to) leading.push(relationship.id);
      }
    }
    return leading.length === 1 ? this.bound(leading[0]) : undefined;
  }

  /** The name a GUI element shows for what it is bound to (a class's name). */
  nameOf(binding: Binding | undefined): string | undefined {
    return binding ? this.resolve(binding)?.name : undefined;
  }

  private classId(ref: string): string | undefined {
    if (this.snapshots.get(ref)?.elementType === 'Class') return ref;
    for (const [id, found] of this.snapshots) if (found.elementType === 'Class' && found.name === ref) return id;
    return undefined;
  }

  private bound(id: string): BoundElement {
    const found = this.snapshots.get(id)!;
    const owner = found.parentElementId ? this.snapshots.get(found.parentElementId) : undefined;
    return {
      elementId: id, elementType: found.elementType, name: found.name,
      ...(owner ? { parent: { elementId: found.parentElementId!, elementType: owner.elementType, name: owner.name } } : {}),
    };
  }
}

interface GuiElement {
  snapshot: Snapshot;
  bindings: Binding[];
}

/** The traced elements of a GUI model, by id: its pages and their traced components. */
function guiElements(model: GuiModelLike | null | undefined, classes: ClassIndex): Map<string, GuiElement> {
  const result = new Map<string, GuiElement>();
  const add = (id: string, elementType: string, titled: string, fallbackName: string, parentId: string, rank: number, bindings: Binding[]) => {
    const bound = bindings
      .map((binding) => classes.resolve(binding))
      .filter((element): element is BoundElement => element !== undefined)
      .map((element) => (element.parent ? `${element.parent.name}.${element.name}` : element.name));
    result.set(id, {
      bindings,
      snapshot: {
        elementType, name: titled || fallbackName, parentElementId: parentId, rank,
        features: {
          name: value(titled),
          // Compared by what the GUI names, shown by what that resolves to in the class diagram.
          bindings: {
            key: bindings.map((b) => `${b.kind}:${b.inClass ?? ''}:${b.ref}:${b.target ?? ''}`).sort().join('|'),
            display: [...new Set(bound)].sort().join(', '),
          },
        },
      },
    });
  };
  const visit = (component: GuiComponentLike, parentId: string, depth: number) => {
    const metaclass = metaclassOf(component);
    const attributes = (component.attributes && typeof component.attributes === 'object' ? component.attributes : {}) as Record<string, unknown>;
    const id = text(attributes.id);
    let ownerId = parentId;
    let childDepth = depth;
    if (metaclass && id && !result.has(id)) {
      const bindings = bindingsOf(attributes);
      const boundClass = classes.nameOf(bindings.find((b) => b.kind === 'class'));
      const titled = NAME_ATTRIBUTES.map((key) => text(attributes[key])).find(Boolean) || text(component.name);
      add(id, metaclass, titled, boundClass ? `${metaclass} of ${boundClass}` : metaclass, parentId, depth, bindings);
      // A table's columns are its parts, each bound to what it shows.
      const dataSource = text(attributes['data-source']);
      for (const column of metaclass === 'Table' ? listOf(attributes.columns) : []) {
        const columnType = text(column.columnType) || 'field';
        const shows = columnType === 'expression' ? text(column.label) : text(column.field);
        const columnId = `${id}#${columnType}:${shows}`;
        if (!COLUMN_METACLASSES[columnType] || !shows || result.has(columnId)) continue;
        add(columnId, COLUMN_METACLASSES[columnType], text(column.label), shows, id, depth + 1, columnBindings(column, dataSource));
      }
      ownerId = id;
      childDepth = depth + 1;
    }
    const children = Array.isArray(component.components) ? (component.components as GuiComponentLike[]) : [];
    for (const child of children) if (child && typeof child === 'object') visit(child, ownerId, childDepth);
  };
  for (const page of model?.pages ?? []) {
    const pageId = text(page.id);
    if (!pageId || result.has(pageId)) continue;
    const name = text(page.name) || 'Page';
    result.set(pageId, {
      bindings: [],
      snapshot: { elementType: 'Screen', name, parentElementId: null, rank: 0, features: { name: value(name) } },
    });
    for (const frame of page.frames ?? []) if (frame?.component) visit(frame.component, pageId, 1);
  }
  return result;
}

const snapshotsOf = (elements: Map<string, GuiElement>) => new Map([...elements].map(([id, e]) => [id, e.snapshot]));

/** The changes that turn the GUI `previous` into `next`. `classModel` (the class diagram the GUI uses) names
 *  what each element is bound to. */
export function diffGuiModel(
  previous: GuiModelLike | null | undefined,
  next: GuiModelLike | null | undefined,
  classModel?: ClassModelLike | null,
): ElementChange[] {
  const classes = new ClassIndex(classModel);
  return diffSnapshots(snapshotsOf(guiElements(previous, classes)), snapshotsOf(guiElements(next, classes)));
}

/** The class-diagram elements each traced element of `model` is bound to, by GUI element id; an element bound
 *  to nothing that `classModel` has is left out. */
export function guiBindings(
  model: GuiModelLike | null | undefined,
  classModel: ClassModelLike | null | undefined,
): Map<string, BoundElement[]> {
  const classes = new ClassIndex(classModel);
  const result = new Map<string, BoundElement[]>();
  for (const [id, element] of guiElements(model, classes)) {
    const bound = new Map<string, BoundElement>();
    for (const binding of element.bindings) {
      const resolved = classes.resolve(binding);
      if (resolved) bound.set(resolved.elementId, resolved);
    }
    if (bound.size > 0) result.set(id, [...bound.values()]);
  }
  return result;
}

/** The classes each page of `model` shows, by page id: the data source of each traced component on it (a page
 *  generated from a class diagram is generated for that class). A page showing none is left out. */
export function pageSources(
  model: GuiModelLike | null | undefined,
  classModel: ClassModelLike | null | undefined,
): Map<string, BoundElement[]> {
  const classes = new ClassIndex(classModel);
  const elements = guiElements(model, classes);
  const pageOf = (id: string): string => {
    let current = id;
    for (let parent = elements.get(current)?.snapshot.parentElementId; parent; parent = elements.get(current)?.snapshot.parentElementId) {
      current = parent;
    }
    return current;
  };
  const result = new Map<string, Map<string, BoundElement>>();
  for (const [id, element] of elements) {
    if (element.snapshot.elementType === 'Screen' || COLUMN_TYPES.has(element.snapshot.elementType)) continue;
    const shown = element.bindings.find((b) => b.kind === 'class');
    const resolved = shown && classes.resolve(shown);
    if (!resolved) continue;
    const page = pageOf(id);
    result.set(page, (result.get(page) ?? new Map()).set(resolved.elementId, resolved));
  }
  return new Map([...result].map(([page, bound]) => [page, [...bound.values()]]));
}

/** Whether a GrapesJS component type is traced (so the GUI editor gives it a persistent id). */
export const isTracedComponent = (component: GuiComponentLike): boolean => metaclassOf(component) !== undefined;
