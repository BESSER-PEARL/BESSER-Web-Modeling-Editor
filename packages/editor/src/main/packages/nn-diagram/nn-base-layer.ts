import { UMLClass } from '../uml-class-diagram/uml-class/uml-class';
import { ILayer } from '../../services/layouter/layer';
import { ILayoutable } from '../../services/layouter/layoutable';
import { UMLRelationshipType } from '../uml-relationship-type';

// Fixed dimensions for icon-based layer display (80px icon + text)
const ICON_LAYER_WIDTH = 110;
const ICON_LAYER_HEIGHT = 110;

/**
 * Base class for all NN layer elements.
 * Uses fixed icon-based sizing - attributes are stored but not displayed on canvas.
 * Attributes are shown only in the popup when clicking the layer.
 */
export abstract class NNBaseLayer extends UMLClass {
  static supportedRelationships: UMLRelationshipType[] = [];
  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    // Use fixed dimensions for icon-based display
    this.bounds.width = ICON_LAYER_WIDTH;
    this.bounds.height = ICON_LAYER_HEIGHT;

    // Don't display attributes on canvas - they're only shown in popup
    this.hasAttributes = false;
    this.hasMethods = false;

    // Return the layer AND children (attributes)
    // Children must be returned so they get added to state for serialization
    // and popup editing, even though they're not visually displayed on canvas
    return [this, ...children];
  }
}
