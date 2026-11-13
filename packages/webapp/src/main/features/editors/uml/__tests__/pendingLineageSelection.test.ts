import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPendingLineageSelection,
  setPendingLineageSelection,
  takePendingLineageSelection,
} from '../pendingLineageSelection';

// Opening the source diagram unmounts the editor component, so the selection
// the "← Source" link asks for lives outside it and is consumed by the next
// editor set up for the source diagram.
describe('pending lineage selection', () => {
  afterEach(() => clearPendingLineageSelection());

  it('is handed once to the editor of the source diagram', () => {
    setPendingLineageSelection('bpmn-1', 'lane-reviewer');
    expect(takePendingLineageSelection('bpmn-1')).toBe('lane-reviewer');
    expect(takePendingLineageSelection('bpmn-1')).toBeNull();
  });

  it('is kept while another diagram is set up', () => {
    setPendingLineageSelection('bpmn-1', 'lane-reviewer');
    expect(takePendingLineageSelection('component-1')).toBeNull();
    expect(takePendingLineageSelection(undefined)).toBeNull();
    expect(takePendingLineageSelection('bpmn-1')).toBe('lane-reviewer');
  });

  it('is dropped when opening the source diagram failed', () => {
    setPendingLineageSelection('bpmn-1', 'lane-reviewer');
    clearPendingLineageSelection();
    expect(takePendingLineageSelection('bpmn-1')).toBeNull();
  });
});
