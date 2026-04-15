import { NNElementType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import * as Apollon from '../../../typings';

export interface INNReference {
  referencedNN: string; // Name of the NN being referenced
}

export class NNReference extends UMLElement implements INNReference {
  type: UMLElementType = NNElementType.NNReference;
  referencedNN: string = '';

  static minWidth = 140;
  static height = 40;
  // Approximate character width for fontSize 12 bold + padding for icon and margins
  static charWidth = 7.5;
  static padding = 40;

  constructor(values?: Partial<NNReference>) {
    super();
    this.name = 'SubNN';
    this.bounds = { x: 0, y: 0, width: NNReference.minWidth, height: NNReference.height };

    if (values) {
      Object.assign(this, values);
      // Clone bounds to avoid mutating the Redux state's bounds object
      this.bounds = { ...this.bounds };
    }

    // Display name shows the referenced NN
    if (this.referencedNN) {
      this.name = this.referencedNN;
    }

    this.bounds.width = this.computeWidth();
  }

  private computeWidth(): number {
    const displayText = this.referencedNN || this.name || 'Select NN...';
    const textWidth = displayText.length * NNReference.charWidth + NNReference.padding;
    return Math.max(NNReference.minWidth, textWidth);
  }

  render(layer: ILayer): ILayoutable[] {
    return [this];
  }

  serialize() {
    return {
      ...super.serialize(),
      referencedNN: this.referencedNN,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T & INNReference) {
    super.deserialize(values);
    if (values.referencedNN !== undefined) {
      this.referencedNN = values.referencedNN;
      this.name = this.referencedNN || 'SubNN';
    }
  }
}
