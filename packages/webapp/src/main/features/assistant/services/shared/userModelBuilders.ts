/**
 * Shared v4 builders for the User Profile (UserDiagram) assistant path.
 *
 * Used by both `UserDiagramConverter` (system/element specs → model) and
 * `UserDiagramModifier` (in-place edits) so both emit identical
 * `UserModelName` rows. Shapes follow `packages/library` canon
 * (`UserModelNameNodeProps` / `UserModelAttributeRow`):
 *   - a criterion row keeps its bare attribute `name` plus a structured
 *     `attributeOperator` and `value` (the canvas formatter composes
 *     "age >= 18" for display; the inspector edits the fields separately),
 *   - links are `UserModelLink` edges (the library's default edge type for
 *     UserDiagram; handled exactly like ObjectLink).
 */

import { generateUniqueId } from '../shared-types';

export const USER_NODE_TYPE = 'UserModelName';
export const USER_LINK_TYPE = 'UserModelLink';

export type UserModelOperator = '<' | '<=' | '==' | '>=' | '>';

const OPERATORS: readonly string[] = ['<', '<=', '==', '>=', '>'];

/** Normalise a raw operator ('=' is accepted as equality); defaults to '=='. */
export const normalizeUserModelOperator = (raw: unknown): UserModelOperator => {
  if (typeof raw !== 'string') return '==';
  const op = raw.trim();
  if (op === '=') return '==';
  return OPERATORS.includes(op) ? (op as UserModelOperator) : '==';
};

export type UserAttributeRow = {
  id: string;
  name: string;
  attributeOperator: UserModelOperator;
  value?: unknown;
  attributeId?: string;
  attributeType?: string;
};

/**
 * Build a criterion row from an attribute spec
 * ({name, operator?, value?, attributeId?, type?}).
 */
export function buildUserAttributeRow(attr: any, id: string = generateUniqueId('userattr')): UserAttributeRow {
  const row: UserAttributeRow = {
    id,
    name: typeof attr?.name === 'string' ? attr.name : '',
    attributeOperator: normalizeUserModelOperator(attr?.operator),
  };
  if (attr?.value !== undefined && attr?.value !== null) row.value = attr.value;
  if (attr?.attributeId) row.attributeId = attr.attributeId;
  if (attr?.type) row.attributeType = attr.type;
  return row;
}

/** Height budget of a profile box: header + one 30px row per criterion. */
export function userNodeHeight(attrCount: number): number {
  return 50 + attrCount * 30;
}

/** Default box width for a profile node. */
export const USER_NODE_WIDTH = 200;
