import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadUserModelValidationRecords,
  saveUserModelValidationRecords,
  semanticModelFingerprint,
  shouldPromptBeforeLeaving,
  userModelValidationStatus,
  type UserModelValidationRecord,
} from '../userModelValidation';

// Live report: "Validate your models before going to the next task" appeared on
// every exit from the User editor, even with no edits, because the records were
// in-memory only and a never-validated model always counted as needing it.
const model = (name: string, x = 0) => ({
  version: '4.0.0',
  type: 'UserDiagram',
  nodes: [{ id: 'u1', type: 'objectName', position: { x, y: 0 }, width: 160, height: 80, measured: { width: 160, height: 80 }, data: { name } }],
  edges: [{ id: 'e1', type: 'ObjectLink', source: 'u1', target: 'u1', data: { name: 'knows', points: [{ x, y: 1 }] } }],
});

const baseline = (m: unknown): UserModelValidationRecord => ({
  validatedAt: null,
  outcome: 'unvalidated',
  fingerprint: semanticModelFingerprint(m),
});

describe('user model validation records', () => {
  beforeEach(() => localStorage.clear());

  it('does not prompt when leaving an unedited model that was never validated', () => {
    const m = model('Alice');
    expect(shouldPromptBeforeLeaving(baseline(m), model('Alice'))).toBe(false);
  });

  it('prompts once the user edited the model since opening it', () => {
    expect(shouldPromptBeforeLeaving(baseline(model('Alice')), model('Bob'))).toBe(true);
  });

  it('ignores layout-only changes (moving a node, edge bend points)', () => {
    expect(shouldPromptBeforeLeaving(baseline(model('Alice', 0)), model('Alice', 250))).toBe(false);
  });

  it('does not ask again for a state the user chose to leave unvalidated', () => {
    const record = { ...baseline(model('Alice')), dismissedFingerprint: semanticModelFingerprint(model('Bob')) };
    expect(shouldPromptBeforeLeaving(record, model('Bob'))).toBe(false);
    expect(shouldPromptBeforeLeaving(record, model('Carol'))).toBe(true);
  });

  it('reports valid / stale / not validated for the sidebar badges', () => {
    const valid: UserModelValidationRecord = { validatedAt: 'now', outcome: 'valid', fingerprint: semanticModelFingerprint(model('A')) };
    expect(userModelValidationStatus(valid, model('A', 99))).toBe('valid');
    expect(userModelValidationStatus(valid, model('B'))).toBe('stale');
    expect(userModelValidationStatus(baseline(model('A')), model('A'))).toBe('not_validated');
    expect(userModelValidationStatus(undefined, model('A'))).toBe('not_validated');
  });

  it('persists records per diagram across reloads', () => {
    saveUserModelValidationRecords({ d1: baseline(model('A')) });
    expect(loadUserModelValidationRecords().d1.fingerprint).toBe(semanticModelFingerprint(model('A')));
    localStorage.setItem('besser_user_model_validation', '{bad');
    expect(loadUserModelValidationRecords()).toEqual({});
  });
});
