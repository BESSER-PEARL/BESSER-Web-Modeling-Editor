import type { PageSnapshot } from '../../../../shared/utils/buildWebAppVersions';
import { apiClient, ApiError } from '../../../../shared/api/api-client';

/** Return a single temporary preview clip, without changing the model. */
export async function requestGuiAudio(snapshot: PageSnapshot, language?: string, signal?: AbortSignal): Promise<Blob> {
  try {
    const result = await apiClient.post<{ clips: { mimeType: string; audio: string }[] }>('/generate-gui-audio',
      { guiPage: snapshot, ...(language && language !== 'original' ? { language } : {}) }, { timeout: 600000, signal });
    if (signal?.aborted) throw new DOMException('Preview canceled', 'AbortError');
    if (!Array.isArray(result?.clips)) throw new Error('The audio service returned an unexpected response. Restart the backend and try again.');
    if (!result.clips.length) throw new Error('This element has no readable text to preview.');
    if (result.clips.length !== 1) throw new Error('Preview one text block at a time.');
    const clip = result.clips[0];
    if (clip.mimeType !== 'audio/wav' || typeof clip.audio !== 'string' || !clip.audio) throw new Error('The audio service returned an invalid clip. Try again.');
    const bytes = Uint8Array.from(atob(clip.audio), character => character.charCodeAt(0));
    return new Blob([bytes], { type: 'audio/wav' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new Error('Restart the updated backend to enable audio preview.');
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('Audio generation timed out. Try again with a shorter text block.');
    throw error;
  }
}
