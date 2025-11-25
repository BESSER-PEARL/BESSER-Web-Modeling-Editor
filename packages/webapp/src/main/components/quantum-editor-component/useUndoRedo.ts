import { useState, useCallback } from 'react';

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

export function useUndoRedo<T>(initialState: T) {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialState,
        future: []
    });

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
                past: [...past, present],
                present: next,
                future: newFuture
            };
        });
    }, []);

    const set = useCallback((newPresent: T | ((current: T) => T)) => {
        setState(currentState => {
            const { past, present, future } = currentState;

            const nextState = newPresent instanceof Function ? newPresent(present) : newPresent;

            if (nextState === present) return currentState;

            return {
                past: [...past, present],
                present: nextState,
                future: [] // Clear future on new action
            };
        });
    }, []);

    return {
        state: state.present,
        setState: set,
        undo,
        redo,
        canUndo,
        canRedo,
        history: state // Expose full history if needed
    };
}
