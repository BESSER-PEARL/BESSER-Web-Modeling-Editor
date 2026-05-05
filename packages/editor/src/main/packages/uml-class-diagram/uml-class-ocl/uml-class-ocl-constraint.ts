import { DeepPartial } from 'redux';
import { UMLElementType } from '../../uml-element-type';
import { ClassRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';

export type OCLConstraintKind = 'invariant' | 'precondition' | 'postcondition';

export interface IUMLClassOCLConstraint extends IUMLElement {
  constraint: string;
  // Discriminator for which list this constraint lands in on the backend:
  // class-level invariant, method precondition, or method postcondition.
  // Absent on legacy diagrams; deserialize defaults to 'invariant'.
  kind?: OCLConstraintKind;
  // Element id of the method this pre/post is anchored to. Absent for
  // invariants (and defaulted to undefined when kind switches back to
  // invariant in the popup).
  targetMethodId?: string;
  // Optional user-supplied constraint name. When empty the backend
  // auto-generates a name like ``{methodName}_pre_{n}``.
  constraintName?: string;
}

export class ClassOCLConstraint extends UMLElement implements IUMLClassOCLConstraint {


  // Define supported relationships - only OCL Link
  static supportedRelationships = [
    ClassRelationshipType.ClassOCLLink
  ];

  type: UMLElementType = UMLElementType.ClassOCLConstraint;
  constraint: string = '';
  kind: OCLConstraintKind = 'invariant';
  targetMethodId?: string;
  constraintName?: string;

  private static readonly MIN_WIDTH = 160;
  private static readonly MIN_HEIGHT = 70;
  private static readonly PADDING = 20;

  constructor(values?: DeepPartial<IUMLClassOCLConstraint>) {
    super(values);
    if (values?.constraint !== undefined) {
      this.constraint = values.constraint;
    }
    if (values?.kind !== undefined) {
      this.kind = values.kind as OCLConstraintKind;
    }
    if (values?.targetMethodId !== undefined) {
      this.targetMethodId = values.targetMethodId;
    }
    if (values?.constraintName !== undefined) {
      this.constraintName = values.constraintName;
    }
    this.adjustSizeToContent();
  }

  serialize() {
    const base = {
      ...super.serialize(),
      constraint: this.constraint,
    } as IUMLClassOCLConstraint;
    // Default-and-omit on serialize so legacy diagrams (no kind set on the
    // input JSON) round-trip byte-stably until they are explicitly edited.
    if (this.kind && this.kind !== 'invariant') {
      base.kind = this.kind;
    } else if (this.kind === 'invariant' && (this.targetMethodId || this.constraintName)) {
      // Edited invariants pick up the explicit tag so the backend takes
      // the kind-aware routing path on the next ingest.
      base.kind = 'invariant';
    }
    if (this.targetMethodId) {
      base.targetMethodId = this.targetMethodId;
    }
    if (this.constraintName) {
      base.constraintName = this.constraintName;
    }
    return base;
  }

  deserialize(values: any) {
    super.deserialize(values);
    this.constraint = values.constraint || '';
    this.kind = (values.kind as OCLConstraintKind) || 'invariant';
    this.targetMethodId = values.targetMethodId || undefined;
    this.constraintName = values.constraintName || undefined;
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