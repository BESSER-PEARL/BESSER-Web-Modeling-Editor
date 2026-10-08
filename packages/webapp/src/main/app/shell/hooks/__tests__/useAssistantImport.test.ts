import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const importImage = vi.hoisted(() => vi.fn(async () => ({ message: 'ok' })));
vi.mock('../../../../features/import/useImportDiagramPicture', () => ({ useImportDiagramPictureFromImage: () => importImage }));
vi.mock('../../../../features/import/useImportDiagramKG', () => ({ useImportDiagramFromKG: () => vi.fn() }));

import { useAssistantImport } from '../useAssistantImport';
import { readLlmKey, writeLlmKey } from '../../../../shared/services/llmKeyStorage';

const project = { id: 'p' } as any;

// Live report: Image -> model and Knowledge-Graph import asked for an OpenAI
// key every time and ignored the key already set in Settings.
describe('image / KG import API key', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    importImage.mockClear();
  });

  it('prefills the OpenAI key set in Settings', () => {
    writeLlmKey('openai', 'sk-settings');
    const { result } = renderHook(() => useAssistantImport({ currentProject: project }));
    act(() => result.current.openAssistantImportDialog('image'));
    expect(result.current.assistantApiKey).toBe('sk-settings');
  });

  it('does not prefill a key for another provider (the endpoints call OpenAI only)', () => {
    writeLlmKey('anthropic', 'sk-ant');
    const { result } = renderHook(() => useAssistantImport({ currentProject: project }));
    act(() => result.current.openAssistantImportDialog('kg'));
    expect(result.current.assistantApiKey).toBe('');
  });

  it('keeps a key typed in the dialog for next time, in sessionStorage only', async () => {
    const { result } = renderHook(() => useAssistantImport({ currentProject: project }));
    act(() => result.current.openAssistantImportDialog('image'));
    act(() => result.current.setAssistantApiKey('sk-typed'));
    const file = new File(['x'], 'd.png', { type: 'image/png' });
    act(() => result.current.handleAssistantFileChange({ target: { files: [file] } } as any));
    await act(() => result.current.handleAssistantImport());
    expect(importImage).toHaveBeenCalledWith(file, 'sk-typed');
    expect(readLlmKey()).toMatchObject({ provider: 'openai', apiKey: 'sk-typed' });
    expect(JSON.stringify({ ...localStorage })).not.toContain('sk-typed');

    act(() => result.current.openAssistantImportDialog('image'));
    expect(result.current.assistantApiKey).toBe('sk-typed');
  });
});
