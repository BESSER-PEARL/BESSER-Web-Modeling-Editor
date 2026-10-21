import { DeepPartial } from 'redux';
import { UMLElementType } from '../../uml-element-type';
import { ClassRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';

/** One structural event that may violate the invariant in this box. */
export interface ViolatingEventRecord {
  constraint?: string | null;
  kind: string;
  class?: string;
  attribute?: string;
  association?: string;
  approximated?: boolean;
}

export interface IUMLClassOCLConstraint extends IUMLElement {
  constraint: string;
  /** Optional plain-language explanation surfaced when validation fails. */
  description?: string;
  /** Events from the last incremental pre-analysis. Absent until that menu item runs. */
  violatingEvents?: ViolatingEventRecord[];
  /** Constraint text those events were computed from. */
  violatingEventsSource?: string;
}

export function formatViolatingEvent(event: ViolatingEventRecord): string {
  if (event.kind === 'UpdateAttribute') {
    return `UpdateAttribute(${event.attribute ?? ''}, ${event.class ?? ''})`;
  }
  if (event.association) {
    return `${event.kind}(${event.association})`;
  }
  return `${event.kind}(${event.class ?? ''})`;
}

export class ClassOCLConstraint extends UMLElement implements IUMLClassOCLConstraint {


  // Define supported relationships - only OCL Link
  static supportedRelationships = [
    ClassRelationshipType.ClassOCLLink
  ];

  type: UMLElementType = UMLElementType.ClassOCLConstraint;
  constraint: string = '';
  description: string = '';
  violatingEvents: ViolatingEventRecord[] = [];
  violatingEventsSource?: string;

  private static readonly MIN_WIDTH = 160;
  private static readonly MIN_HEIGHT = 70;
  private static readonly PADDING = 20;

  constructor(values?: DeepPartial<IUMLClassOCLConstraint>) {
    super(values);
    if (values?.constraint !== undefined) {
      this.constraint = values.constraint;
    }
    if (values?.description !== undefined) {
      this.description = values.description;
    }
    if (values?.violatingEvents) {
      this.violatingEvents = values.violatingEvents as ViolatingEventRecord[];
    }
    if (values?.violatingEventsSource != null) {
      this.violatingEventsSource = values.violatingEventsSource;
    }
    this.adjustSizeToContent();
  }

  serialize() {
    const analyzed = this.violatingEventsSource != null;
    return {
      ...super.serialize(),
      constraint: this.constraint,
      description: this.description,
      ...(analyzed
        ? {
            violatingEvents: this.violatingEvents,
            violatingEventsSource: this.violatingEventsSource,
          }
        : {}),
    };
  }

  deserialize(values: any) {
    super.deserialize(values);
    this.constraint = values.constraint || '';
    this.description = values.description || '';
    this.violatingEvents = Array.isArray(values.violatingEvents) ? values.violatingEvents : [];
    this.violatingEventsSource = values.violatingEventsSource ?? undefined;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [];

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const charsPerLine = Math.floor((maxWidth - 40) / 8); // Account for padding

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= charsPerLine) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        if (word.length > charsPerLine) {
          // Split long words
          const chunks = word.match(new RegExp(`.{1,${charsPerLine}}`, 'g')) || [];
          lines.push(...chunks.slice(0, -1));
          currentLine = chunks[chunks.length - 1] || '';
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  private adjustSizeToContent() {
    // Ensure minimum dimensions
    this.bounds.width = Math.max(ClassOCLConstraint.MIN_WIDTH, this.bounds.width || ClassOCLConstraint.MIN_WIDTH);
    this.bounds.height = Math.max(ClassOCLConstraint.MIN_HEIGHT, this.bounds.height || ClassOCLConstraint.MIN_HEIGHT);
  }

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
