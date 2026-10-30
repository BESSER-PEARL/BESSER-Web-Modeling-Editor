import { useCallback, useContext } from 'react';
import { useProject } from '../../../app/hooks/useProject';
import { BesserEditorContext } from '../../editors/uml/besser-editor-context';

/** Writes the open diagram into the stored project, so a GitHub action reads the latest model. */
export function useFlushEditorModel() {
  const { currentProject, updateCurrentDiagram } = useProject();
  const editor = useContext(BesserEditorContext)?.editor;
  return useCallback(() => {
    if (!editor || !currentProject) return;
    try {
      updateCurrentDiagram(editor.model);
    } catch (error) {
      console.error('Failed to save editor state:', error);
    }
  }, [editor, currentProject, updateCurrentDiagram]);
}
