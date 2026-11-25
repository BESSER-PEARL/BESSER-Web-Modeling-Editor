import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGuiReadAloudControls } from '../setup/guiReadAloudControls';
import { apiClient } from '../../../../shared/api/api-client';

vi.mock('../../../../shared/api/api-client', () => ({ apiClient: { post: vi.fn() }, ApiError: class extends Error {} }));
const response = { clips: [{ mimeType: 'audio/wav', audio: 'UklGRg==' }] };

function setup() {
  const callbacks = new Map<string, Set<(...args: any[]) => void>>();
  const component = (id: string) => {
    const element = document.createElement('p'); element.id = id; element.textContent = `Read text block ${id}.`; document.body.append(element);
    const attrs = { 'data-besser-read-aloud': 'true' };
    return { getEl: () => element, getAttributes: () => attrs, toJSON: () => ({ type: 'text', tagName: 'p', content: element.textContent, attributes: attrs }) };
  };
  const first = component('one'); const second = component('two');
  const root = { components: () => ({ forEach: (fn: any) => [first, second].forEach(fn) }) };
  let pageId = 'home'; let variant = 'alice';
  const page = { getId: () => pageId, getMainComponent: () => root, get: (key: string) => key === 'besserActiveVariantId' ? variant : JSON.stringify([{ id: variant, readAloudEnabled: true }]) };
  const editor: any = { Pages: { getSelected: () => page }, Canvas: { getBody: () => document.body },
    on: (event: string, fn: any) => { const list = callbacks.get(event) ?? new Set(); list.add(fn); callbacks.set(event, list); },
    off: (event: string, fn: any) => callbacks.get(event)?.delete(fn),
  };
  const emit = (event: string) => [...callbacks.get(event) ?? []].forEach(fn => fn());
  const dispose = setupGuiReadAloudControls(editor);
  return { emit, dispose, changePage: () => { pageId = 'other'; emit('page:select'); }, changeVariant: () => { variant = 'bob'; emit('page:update'); } };
}

describe('inline canvas audio playback', () => {
  let current: ReturnType<typeof setup> | undefined;
  const playing = new WeakSet<HTMLMediaElement>();
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue(response);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:inline-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function(this: HTMLMediaElement) { return !playing.has(this); });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) { playing.add(this); this.dispatchEvent(new Event('play')); return Promise.resolve(); });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function(this: HTMLMediaElement) { playing.delete(this); this.dispatchEvent(new Event('pause')); });
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });
  afterEach(() => { current?.dispose(); current = undefined; vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
  const controls = () => document.querySelectorAll('[data-besser-read-aloud-preview]');
  const playButton = (index = 0) => controls()[index].querySelector('button')!;

  it('plays beside the text without a popup and reuses audio only within the current page', async () => {
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    expect(apiClient.post).not.toHaveBeenCalled();
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    expect(playButton().textContent).toContain('Pause');
    expect(document.querySelector('audio')!.hidden).toBe(true);
    expect(document.querySelector('#besser-audio-panel')).toBeNull();
    playButton().click(); expect(playButton().textContent).toContain('Play');
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    current.changePage();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:inline-preview');
    expect(document.querySelectorAll('audio')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(35); playButton().click(); await vi.advanceTimersByTimeAsync(0);
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('pauses the first block when another one starts and resets playback with Stop', async () => {
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    playButton(1).click(); await vi.advanceTimersByTimeAsync(0);
    const audio = document.querySelectorAll('audio');
    expect(audio[0].paused).toBe(true); expect(audio[1].paused).toBe(false);
    audio[1].currentTime = 10;
    (controls()[1].querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(audio[1].paused).toBe(true); expect(audio[1].currentTime).toBe(0);
  });

  it('aborts pending previews and discards late audio on a variant switch', async () => {
    let resolve!: (value: any) => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise(done => { resolve = done; }));
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click(); expect(playButton().textContent).toContain('Generating');
    const signal = vi.mocked(apiClient.post).mock.calls[0][2]!.signal!;
    current.changeVariant(); expect(signal.aborted).toBe(true);
    resolve(response); await vi.advanceTimersByTimeAsync(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each(['destroy', 'pagehide'])('releases playback when %s occurs', async event => {
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    if (event === 'destroy') current.emit('destroy'); else window.dispatchEvent(new Event('pagehide'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:inline-preview');
    expect(document.querySelectorAll('audio')).toHaveLength(0);
  });

  it('shows failures next to their text block and permits a retry', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('TTS provider unavailable'));
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    expect(controls()[0].querySelector('[role="alert"]')!.textContent).toContain('provider unavailable');
    expect(playButton().disabled).toBe(false);
  });

  it('invalidates a clip when its text changes', async () => {
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    document.getElementById('one')!.textContent = 'Updated wording.';
    current.emit('component:update'); await vi.advanceTimersByTimeAsync(35);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:inline-preview');
    expect(document.querySelectorAll('audio')).toHaveLength(0);
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    expect(apiClient.post).toHaveBeenLastCalledWith('/generate-gui-audio', expect.objectContaining({
      guiPage: expect.objectContaining({ components: [expect.objectContaining({ content: 'Updated wording.' })] }),
    }), expect.anything());
  });

  it('releases audio when the browser tab is hidden', async () => {
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click(); await vi.advanceTimersByTimeAsync(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:inline-preview');
    expect(document.querySelectorAll('audio')).toHaveLength(0);
  });

  it('does not let a canceled response clear the next generation request', async () => {
    const replies: ((value: any) => void)[] = [];
    vi.mocked(apiClient.post).mockImplementation(() => new Promise<any>(resolve => { replies.push(resolve); }));
    current = setup(); await vi.advanceTimersByTimeAsync(35);
    playButton().click();
    (controls()[0].querySelectorAll('button')[1] as HTMLButtonElement).click();
    playButton().click();
    replies[0](response); await vi.advanceTimersByTimeAsync(0);
    expect(playButton().disabled).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    replies[1](response); await vi.advanceTimersByTimeAsync(0);
    expect(playButton().textContent).toContain('Pause');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
