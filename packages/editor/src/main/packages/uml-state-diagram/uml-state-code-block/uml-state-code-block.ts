import { DeepPartial } from 'redux';
import { StateElementType, StateRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { UMLElementType } from '../../uml-element-type';

export interface IUMLStateCodeBlock extends IUMLElement {
  code: string;
  language: string;
  _codeContent?: string; // Internal property to preserve code
}

export class UMLStateCodeBlock extends UMLElement implements IUMLStateCodeBlock {
  static supportedRelationships = [StateRelationshipType.StateTransition];
  static features: UMLElementFeatures = { ...UMLElement.features, resizable: true };
  
  type: UMLElementType = StateElementType.StateCodeBlock;
  code: string = '';
  language: string = 'python';
  _codeContent?: string; // Internal property to preserve code
  
  bounds: IBoundary = { 
    ...this.bounds, 
    width: 200, 
    height: 150 
  };

  constructor(values?: DeepPartial<IUMLStateCodeBlock>) {
    super(values);
    assign<IUMLStateCodeBlock>(this, values);
    if (values?.code) {
      this._codeContent = values.code;
      this.code = values.code;
    }
    this.language = 'python';
  }

  render(canvas: ILayer): ILayoutable[] {
    // Enforce minimum dimensions for readability
    this.bounds.width = Math.max(this.bounds.width, 150);
    this.bounds.height = Math.max(this.bounds.height, 100);
    
    // Ensure code is sync'd with _codeContent
    if (this._codeContent && !this.code) {
      this.code = this._codeContent;
    }
    
    return [this];
  }

  serialize(): any {
    const base = super.serialize();
    
    // Use _codeContent if available, otherwise fallback to code
    const codeToSerialize = this._codeContent || this.code || '';
    
    return {
      ...base,
      type: this.type,
      code: codeToSerialize,
      language: this.language
    };
  }
  
  deserialize(values: any): void {
    super.deserialize(values);
    
    if (values.code) {
      this._codeContent = values.code;
      this.code = values.code;
    }
    
    // Set language with Python default
    this.language = values.language || 'python';
  }
}