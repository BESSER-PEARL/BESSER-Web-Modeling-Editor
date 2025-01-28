import { DeepPartial } from 'redux';
import { UMLElementType } from '../../uml-element-type';
import { ClassRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';

export interface IUMLClassOCLConstraint extends IUMLElement {
  constraint: string;
}

export class ClassOCLConstraint extends UMLElement implements IUMLClassOCLConstraint {

  
  // Define supported relationships - only OCL Link
  static supportedRelationships = [
    ClassRelationshipType.ClassOCLLink
  ];

  type: UMLElementType = UMLElementType.ClassOCLConstraint;
  constraint: string = '';

  private static readonly MIN_WIDTH = 160;
  private static readonly MIN_HEIGHT = 70;
  private static readonly PADDING = 20;

  constructor(values?: DeepPartial<IUMLClassOCLConstraint>) {
    super(values);
    if (values?.constraint !== undefined) {
      this.constraint = values.constraint;
    }
    this.adjustSizeToContent();
  }

  serialize() {
    return {
      ...super.serialize(),
      constraint: this.constraint
    };
  }

  deserialize(values: any) {
    super.deserialize(values);
    this.constraint = values.constraint || '';
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