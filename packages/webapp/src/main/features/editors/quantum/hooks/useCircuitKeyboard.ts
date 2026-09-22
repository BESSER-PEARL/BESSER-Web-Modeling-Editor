import { useEffect, useRef } from 'react';
import { CircuitEditorState } from './useCircuitEditor';

interface UseCircuitKeyboardOptions {
    editor: CircuitEditorState;
    isActive?: boolean; // Whether this keyboard handler is active (for nested modals)
    capturePhase?: boolean; // Use capture phase for priority
}

/**
 * Hook to handle keyboard shortcuts for circuit editing.
 * Handles undo/redo, copy/paste, and delete.
 */
export function useCircuitKeyboard({
    editor,
    isActive = true,
    capturePhase = false,
}: UseCircuitKeyboardOptions) {
    const editorRef = useRef(editor);
    
    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
            const currentEditor = editorRef.current;

            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                if (currentEditor.canUndo) {
                    currentEditor.undo();
                    e.preventDefault();
                    if (capturePhase) e.stopImmediatePropagation();
                }
                return;
            }

            // Redo: Ctrl+Shift+Z or Ctrl+Y
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                if (currentEditor.canRedo) {
                    currentEditor.redo();
                    e.preventDefault();
                    if (capturePhase) e.stopImmediatePropagation();
                }
                return;
            }

            // Copy: Ctrl+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isInputField) {
                currentEditor.handleCopy();
                e.preventDefault();
                if (capturePhase) e.stopImmediatePropagation();
                return;
            }

            // Paste: Ctrl+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInputField) {
                currentEditor.handlePaste();
                e.preventDefault();
                if (capturePhase) e.stopImmediatePropagation();
                return;
            }

            // Delete: Delete or Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputField) {
                if (currentEditor.selectedGate) {
                    currentEditor.handleDelete();
                    e.preventDefault();
                    if (capturePhase) e.stopImmediatePropagation();
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown, capturePhase);
        return () => window.removeEventListener('keydown', handleKeyDown, capturePhase);
    }, [isActive, capturePhase]);
}
