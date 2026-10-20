/**
 * Agent components (LLMs, intents, RAG, ...) live off-canvas in
 * `model.components`, so the editor's canvas snapshot does not carry them.
 * Diagram JSON export used `editor.model` as-is and silently dropped them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BesserEditor, UMLDiagramType, UMLModel } from '@besser/wme';

import { createEmptyDiagram } from '../../../shared/types/project';
import { _resetBesserVersionCacheForTests } from '../../../shared/services/besserVersion';

const downloadFile = vi.fn();
vi.mock('../../../shared/services/file-download/useFileDownload', () => ({
  useFileDownload: () => downloadFile,
}));

import { useExportJSON } from '../useExportJson';

const LLM = { id: 'llm-1', name: 'gpt-4o', type: 'AgentLLM', owner: null, provider: 'openai' };

const readExported = async () => {
  const file: File = downloadFile.mock.calls[0][0].file;
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
  return JSON.parse(text);
};

describe('useExportJSON', () => {
  beforeEach(() => {
    downloadFile.mockClear();
    _resetBesserVersionCacheForTests();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ besser_version: '8.0.0' }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the stored agent components in a single-diagram export', async () => {
    const canvasModel = createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram).model as UMLModel;
    const diagram = {
      ...createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram),
      model: { ...canvasModel, components: { [LLM.id]: LLM } as UMLModel['components'] },
    };
    const editor = { model: canvasModel } as unknown as BesserEditor;

    const { result } = renderHook(() => useExportJSON());
    await result.current(editor, diagram);

    const exported = await readExported();
    expect(exported.model.components).toEqual({ [LLM.id]: LLM });
  });

  it('records the BESSER and editor versions in a single-diagram export', async () => {
    const diagram = createEmptyDiagram('Library', UMLDiagramType.ClassDiagram);
    const editor = { model: diagram.model } as unknown as BesserEditor;

    const { result } = renderHook(() => useExportJSON());
    await result.current(editor, diagram);

    const exported = await readExported();
    expect(exported.besserVersion).toBe('8.0.0');
    expect(typeof exported.editorVersion).toBe('string');
    expect(exported.model.type).toBe(UMLDiagramType.ClassDiagram);
  });
});
