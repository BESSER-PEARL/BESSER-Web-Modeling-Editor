import { DeepPartial } from 'redux';
import { UMLClassifierAttribute } from '../common/uml-classifier/uml-classifier-attribute';
import { IUMLClassifierMember } from '../common/uml-classifier/uml-classifier-member';
import { IBoundary, computeDimension } from '../../utils/geometry/boundary';
import { IUMLElement } from '../../services/uml-element/uml-element';

export interface INNAttribute extends IUMLElement {
  attributeName: string;
  value: string;
  isMandatory: boolean;
  attributeType?: string;
}

/**
 * Base class for all NN component attributes (layers, tensorops, configuration).
 * Uses smaller height (22px instead of 30px) to make NN boxes more compact.
 */
export abstract class NNComponentAttribute extends UMLClassifierAttribute {
  // Override bounds to use smaller height for NN attributes
  bounds: IBoundary = { ...this.bounds, height: computeDimension(1.0, 22) };

  constructor(values?: DeepPartial<IUMLClassifierMember>) {
    super(values);
    // Ensure the height is set correctly after super constructor
    this.bounds.height = computeDimension(1.0, 22);
  }
}
