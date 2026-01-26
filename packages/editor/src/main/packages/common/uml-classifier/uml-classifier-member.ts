import { DeepPartial } from 'redux';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary, computeDimension } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import * as Apollon from '../../../typings';

// Type alias mapping for normalizing types from various sources (agent responses, imports, etc.)
const TYPE_ALIASES: Record<string, string> = {
  // String variants
  'string': 'str', 'String': 'str', 'STRING': 'str',
  // Integer variants
  'integer': 'int', 'Integer': 'int', 'INTEGER': 'int', 'long': 'int', 'Long': 'int',
  // Float/Double variants
  'double': 'float', 'Double': 'float', 'DOUBLE': 'float', 'Float': 'float', 'FLOAT': 'float',
  'number': 'float', 'Number': 'float', 'decimal': 'float', 'Decimal': 'float',
  // Boolean variants
  'boolean': 'bool', 'Boolean': 'bool', 'BOOLEAN': 'bool',
  // Date variants
  'Date': 'date', 'DATE': 'date',
  // DateTime variants
  'DateTime': 'datetime', 'DATETIME': 'datetime', 'Timestamp': 'datetime', 'timestamp': 'datetime',
  // Time variants
  'Time': 'time', 'TIME': 'time',
  // Any variants
  'object': 'any', 'Object': 'any', 'void': 'any', 'Void': 'any',
};

// Normalize a type string to the canonical Python-style type
const normalizeType = (type: string): string => {
  if (!type) return 'str';
  const trimmed = type.trim();
  return TYPE_ALIASES[trimmed] || trimmed;
};

// Visibility type
export type Visibility = 'public' | 'private' | 'protected' | 'package';

// Visibility symbol mapping
const VISIBILITY_SYMBOLS: Record<Visibility, string> = {
  'public': '+',
  'private': '-',
  'protected': '#',
  'package': '~',
};

const SYMBOL_TO_VISIBILITY: Record<string, Visibility> = {
  '+': 'public',
  '-': 'private',
  '#': 'protected',
  '~': 'package',
};

export type MethodImplementationType = 'none' | 'code' | 'state_machine' | 'quantum_circuit';

export interface IUMLClassifierMember extends IUMLElement {
  code?: string;
  visibility?: Visibility;
  attributeType?: string;
  implementationType?: MethodImplementationType;
  stateMachineId?: string;
  quantumCircuitId?: string;
}

export abstract class UMLClassifierMember extends UMLElement implements IUMLClassifierMember {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    hoverable: false,
    selectable: false,
    movable: false,
    resizable: false,
    connectable: false,
    droppable: false,
    updatable: false,
  };

  bounds: IBoundary = { ...this.bounds, height: computeDimension(1.0, 30) };
  code: string = '';
  visibility: Visibility = 'public';
  attributeType: string = 'str';
  implementationType: MethodImplementationType = 'none';
  stateMachineId: string = '';
  quantumCircuitId: string = '';

  constructor(values?: DeepPartial<IUMLClassifierMember>) {
    super(values);
    assign<IUMLClassifierMember>(this, values);
  }

  /**
   * Get the display name for rendering (combines visibility symbol, name, and type)
   */
  get displayName(): string {
    const visSymbol = VISIBILITY_SYMBOLS[this.visibility] || '+';
    if (this.name && this.attributeType) {
      // Check if name already contains visibility symbol (legacy format)
      if (/^[+\-#~]\s/.test(this.name)) {
        return this.name;
      }
      return `${visSymbol} ${this.name}: ${this.attributeType}`;
    }
    // Fallback to name for backward compatibility or simple display
    return this.name;
  }

  /**
   * Parse legacy name format and extract visibility, name, and attributeType
   * Used for backward compatibility when loading old diagrams
   */
  static parseNameFormat(name: string): { visibility: Visibility; name: string; attributeType: string } {
    const trimmed = name.trim();
    let visibility: Visibility = 'public';
    let parsedName = '';
    let attributeType = 'str';

    // Check for visibility symbol at the start
    const visibilityMatch = trimmed.match(/^([+\-#~])\s*/);
    if (visibilityMatch) {
      visibility = SYMBOL_TO_VISIBILITY[visibilityMatch[1]] || 'public';
      const afterVisibility = trimmed.substring(visibilityMatch[0].length);

      // Check for type (after colon)
      const typeMatch = afterVisibility.match(/^([^:]+):\s*(.+)$/);
      if (typeMatch) {
        parsedName = typeMatch[1].trim();
        attributeType = normalizeType(typeMatch[2].trim());
      } else {
        parsedName = afterVisibility.trim();
      }
    } else {
      // No visibility symbol, check for type
      const typeMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
      if (typeMatch) {
        parsedName = typeMatch[1].trim();
        attributeType = normalizeType(typeMatch[2].trim());
      } else {
        parsedName = trimmed;
      }
    }

    return { visibility, name: parsedName, attributeType };
  }

  /** Serializes an `UMLClassifierMember` to an `Apollon.UMLModelElement` */
  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      code: this.code,
      visibility: this.visibility,
      attributeType: this.attributeType,
      implementationType: this.implementationType,
      stateMachineId: this.stateMachineId,
      quantumCircuitId: this.quantumCircuitId,
    } as Apollon.UMLModelElement & Apollon.UMLClassifierMember;
  }

  /** Deserializes an `Apollon.UMLModelElement` to an `UMLClassifierMember` */
  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]) {
    super.deserialize(values, children);
    const memberValues = values as T & Apollon.UMLClassifierMember;
    this.code = memberValues.code || '';
    
    // Check if we have new format properties (visibility and attributeType set)
    if (memberValues.visibility !== undefined && memberValues.attributeType !== undefined) {
      // New format - use separate properties, name is already set by super.deserialize()
      this.visibility = memberValues.visibility || 'public';
      this.attributeType = memberValues.attributeType || 'str';
    } else {
      // Legacy format - parse from name to extract visibility and type
      const parsed = UMLClassifierMember.parseNameFormat(this.name);
      this.visibility = parsed.visibility;
      this.attributeType = parsed.attributeType;
      // Update name to just the attribute name (without visibility symbol and type)
      this.name = parsed.name;
    }
    
    // Deserialize implementation type fields
    this.implementationType = memberValues.implementationType || 'none';
    this.stateMachineId = memberValues.stateMachineId || '';
    this.quantumCircuitId = memberValues.quantumCircuitId || '';
    
    // Auto-detect implementation type if not set but code exists
    if (this.implementationType === 'none' && this.code) {
      this.implementationType = 'code';
    }
  }

  render(layer: ILayer): ILayoutable[] {
    const radix = 10;
    // Use displayName for rendering to show the formatted attribute string
    const displayText = this.displayName;
    const width = Text.size(layer, displayText).width + 20;
    this.bounds.width = Math.max(this.bounds.width, Math.round(width / radix) * radix);
    return [this];
  }
}
