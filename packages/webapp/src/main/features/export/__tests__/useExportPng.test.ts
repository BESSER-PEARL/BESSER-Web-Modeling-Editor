import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApollonEditor } from '@besser/wme';

const downloadFile = vi.fn();
vi.mock('../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => downloadFile }));

import { useExportPNG } from '../useExportPng';

const editor = {
  exportAsSVG: vi.fn(async () => ({
    svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    clip: { x: 0, y: 0, width: 10, height: 10 },
  })),
} as unknown as ApollonEditor;

/** An Image stand-in that fires onload or onerror as soon as its src is set. */
const stubImage = (outcome: 'load' | 'error') => {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 0;
    height = 0;
    set src(_value: string) {
      queueMicrotask(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
};

describe('useExportPNG', () => {
  beforeEach(() => {
    downloadFile.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects instead of hanging when the canvas cannot be exported', async () => {
    stubImage('load');
    // What Chrome throws for a canvas tainted by an SVG holding <foreignObject>.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {
      throw new DOMException('Tainted canvases may not be exported.', 'SecurityError');
    });
    const { result } = renderHook(() => useExportPNG());

    await expect(result.current(editor, 'Agent', true)).rejects.toThrow('Tainted canvases may not be exported.');
    expect(downloadFile).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('rejects with a readable error when the SVG does not load as an image', async () => {
    stubImage('error');
    const { result } = renderHook(() => useExportPNG());

    await expect(result.current(editor, 'Agent', true)).rejects.toThrow('Failed to load the diagram SVG as an image');
  });

  it('downloads the PNG when the conversion succeeds', async () => {
    stubImage('load');
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) =>
      callback(new Blob(['png'], { type: 'image/png' })),
    );
    const { result } = renderHook(() => useExportPNG());

    await result.current(editor, 'Agent', false);
    expect(downloadFile).toHaveBeenCalledWith(expect.objectContaining({ filename: 'Agent.png' }));
  });
});
