import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestGuiAudio } from '../setup/guiAudio';
import { apiClient, ApiError } from '../../../../shared/api/api-client';

vi.mock('../../../../shared/api/api-client', () => ({ apiClient: { post: vi.fn() }, ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
const snapshot = { components: [{ type: 'text', content: 'Read these instructions before starting.' }], css: [] };
describe('temporary audio requests', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.post).mockResolvedValue({ clips: [{ mimeType: 'audio/wav', audio: 'UklGRg==' }] }); });
  afterEach(() => vi.restoreAllMocks());
  it('returns an in-memory audio blob without modifying the model', async () => {
    const original = JSON.stringify(snapshot);
    const controller = new AbortController();
    const blob = await requestGuiAudio(snapshot, 'fr', controller.signal);
    expect(blob.type).toBe('audio/wav'); expect(blob.size).toBe(4);
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(apiClient.post).toHaveBeenCalledWith('/generate-gui-audio', { guiPage: snapshot, language: 'fr' }, { timeout: 600000, signal: controller.signal });
  });
  it('discards canceled requests even if the transport returns a late response', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(requestGuiAudio(snapshot, undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('explains an unavailable backend', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(404, 'Not Found'));
    await expect(requestGuiAudio(snapshot)).rejects.toThrow('Restart the updated backend');
  });
  it('rejects empty or incompatible responses', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ clips: [] });
    await expect(requestGuiAudio(snapshot)).rejects.toThrow('no readable text');
    vi.mocked(apiClient.post).mockResolvedValue({ guiPage: snapshot });
    await expect(requestGuiAudio(snapshot)).rejects.toThrow('unexpected response');
  });
});
