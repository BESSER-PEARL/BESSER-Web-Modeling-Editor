/**
 * Standalone undo stack for assistant model modifications.
 *
 * Previously part of UMLModelingService; extracted to remove
 * the editor dependency from the undo system.
 *
 * The stack is module-level (singleton) so all consumers share
 * the same history regardless of where they import from.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UndoEntry {
  model: any;
  description: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const MAX_UNDO_STACK = 10;
let undoStack: UndoEntry[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Push the current model onto the undo stack before making changes.
 */
export function pushUndoSnapshot(currentModel: any, description: string): void {
  undoStack.push({
    model: structuredClone(currentModel),
    description,
    timestamp: Date.now(),
  });
  // Keep stack bounded
  if (undoStack.length > MAX_UNDO_STACK) {
    undoStack.shift();
  }
}

/**
 * Pop the last model snapshot from the undo stack.
 * Returns null if stack is empty.
 */
export function popUndo(): { model: any; description: string } | null {
  return undoStack.pop() || null;
}

/**
 * Check if undo is available.
 */
export function canUndo(): boolean {
  return undoStack.length > 0;
}

/**
 * Get the description of the last undoable action.
 */
export function getLastUndoDescription(): string | null {
  return undoStack.length > 0 ? undoStack[undoStack.length - 1].description : null;
}

/**
 * Clear the undo stack (e.g., on diagram switch).
 */
export function clearUndoStack(): void {
  undoStack = [];
}

/**
 * Get the current size of the undo stack.
 */
export function getUndoStackSize(): number {
  return undoStack.length;
}
