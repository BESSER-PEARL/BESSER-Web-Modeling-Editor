import { useState, useCallback, useEffect, useRef } from 'react';

const DEFAULT_MAX_HISTORY = 100;

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

export interface UseUndoRedoOptions {
    /** Steps kept for undo. Lower it when each snapshot is large. Default 100. */
    maxHistory?: number;
}

export interface SetStateOptions {
    /**
     * `false` replaces the current state without making it an undo step, and
     * leaves the existing history alone. For changes the user did not make
     * (e.g. an automatic layout). Default `true`.
     */
    record?: boolean;
}

/**
 * @param initialState - The starting state for undo/redo history. Replacing it
 *                   with a different value restarts the history, so pass a
 *                   stable value, and use `reset` to swap the state later.
 * @param resetKey - Optional key that, when changed, forces a full history reset.
 *                   Use this to tie history to a specific diagram or project ID
 *                   so that switching contexts always clears stale undo/redo entries.
 * @param options  - See {@link UseUndoRedoOptions}.
 */
export function useUndoRedo<T>(initialState: T, resetKey?: string, options: UseUndoRedoOptions = {}) {
    const maxHistory = Math.max(1, options.maxHistory ?? DEFAULT_MAX_HISTORY);
    const maxHistoryRef = useRef(maxHistory);
    maxHistoryRef.current = maxHistory;

    const [state, setState] = useState<HistoryState<T>>(() => ({
        past: [],
        present: initialState,
        future: []
    }));

    // Track if this is the first render to avoid resetting on mount
    const isFirstRender = useRef(true);
    const lastResetKey = useRef(resetKey);

    // Reset state when initialState changes (e.g., project switch)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        // Reset to new initial state, clearing history
        setState({
            past: [],
            present: initialState,
            future: []
        });
    }, [initialState]);

    // Force reset when resetKey changes (e.g., project/diagram ID switch)
    useEffect(() => {
        if (resetKey !== undefined && lastResetKey.current !== resetKey) {
            const isFirst = lastResetKey.current === undefined && isFirstRender.current;
            lastResetKey.current = resetKey;
            if (isFirst) return; // Skip on initial mount
            setState({
                past: [],
                present: initialState,
                future: []
            });
        }
    }, [resetKey, initialState]);

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const undo = useCallback(() => {
        setState(currentState => {
            const { past, present, future } = currentState;
            if (past.length === 0) return currentState;

            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);

            return {
                past: newPast,
                present: previous,
                future: [present, ...future]
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState(currentState => {
            const { past, present, future } = currentState;
            if (future.length === 0) return currentState;

            const next = future[0];
            const newFuture = future.slice(1);

            return {
                past: [...past.slice(-(maxHistoryRef.current - 1)), present],
                present: next,
                future: newFuture
            };
        });
    }, []);

    const set = useCallback((newPresent: T | ((current: T) => T), setOptions?: SetStateOptions) => {
        setState(currentState => {
            const { past, present, future } = currentState;

            const nextState = newPresent instanceof Function ? newPresent(present) : newPresent;

            if (nextState === present) return currentState;

            if (setOptions?.record === false) {
                return { past, present: nextState, future };
            }

            return {
                past: [...past.slice(-(maxHistoryRef.current - 1)), present],
                present: nextState,
                future: [] // Clear future on new action
            };
        });
    }, []);

    /** Replace the state and start a new, empty history (e.g. a different diagram was loaded). */
    const reset = useCallback((next: T) => {
        setState({ past: [], present: next, future: [] });
    }, []);

    return {
        state: state.present,
        setState: set,
        reset,
        undo,
        redo,
        canUndo,
        canRedo,
        history: state // Expose full history if needed
    };
}
