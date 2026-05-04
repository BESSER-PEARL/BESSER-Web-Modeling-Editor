/**
 * Shared utilities used across modifiers and converters.
 * Re-exports everything from sub-modules for convenient access.
 */

export { TYPE_ALIASES, VALID_PRIMITIVES, normalizeType } from './typeNormalization';
export {
  LAYOUT_COLUMNS,
  LAYOUT_H_GAP,
  LAYOUT_V_GAP,
  LAYOUT_START_X,
  LAYOUT_START_Y,
  calculateGridPosition,
} from './layoutUtils';
