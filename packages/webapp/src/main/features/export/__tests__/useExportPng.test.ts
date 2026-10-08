import { describe, it, expect, vi, afterEach } from 'vitest';
import { convertRenderedSVGToPNG } from '../useExportPng';

const SVG_RESULT = {
  svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  clip: { x: 0, y: 0, width: 10, height: 10 },
};

/** An Image that "loads" as soon as its src is set. */
class LoadingImage {
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('convertRenderedSVGToPNG', () => {
  it('rejects (so the export spinner clears) when the canvas is tainted', async () => {
    vi.stubGlobal('Image', LoadingImage);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {
      throw new DOMException('Tainted canvases may not be exported.', 'SecurityError');
    });

    await expect(convertRenderedSVGToPNG(SVG_RESULT, true)).rejects.toThrow(/Tainted canvases/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});
