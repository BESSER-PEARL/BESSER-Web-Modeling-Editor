/**
 * Agent components (LLMs, intents, RAG, ...) live off-canvas in
 * `model.components`, so the editor's canvas snapshot does not carry them.
 * Diagram JSON export used `editor.model` as-is and silently dropped them.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ApollonEditor, UMLDiagramType, UMLModel } from '@besser/wme';

import { createEmptyDiagram } from '../../../shared/types/project';

const downloadFile = vi.fn();
vi.mock('../../../shared/services/file-download/useFileDownload', () => ({
  useFileDownload: () => downloadFile,
}));

import { useExportJSON } from '../useExportJson';

const LLM = { id: 'llm-1', name: 'gpt-4o', type: 'AgentLLM', owner: null, provider: 'openai' };

describe('useExportJSON', () => {
  it('keeps the stored agent components in a single-diagram export', async () => {
    const canvasModel = createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram).model as UMLModel;
    const diagram = {
      ...createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram),
      model: { ...canvasModel, components: { [LLM.id]: LLM } as UMLModel['components'] },
    };
    const editor = { model: canvasModel } as unknown as ApollonEditor;

    const { result } = renderHook(() => useExportJSON());
    result.current(editor, diagram);

    const file: File = downloadFile.mock.calls[0][0].file;
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });
    const exported = JSON.parse(text);
    expect(exported.model.components).toEqual({ [LLM.id]: LLM });
  });
});
