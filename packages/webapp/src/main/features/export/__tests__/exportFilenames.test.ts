import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const download = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => download }));

import { bumlExportFilename } from '../useExportBuml';
import { useExportPNG } from '../useExportPng';

// Live report: a diagram's B-UML export downloaded as the backend's generic
// "domain_model.py", and the white and transparent PNG exports shared one name.
describe('export file names', () => {
  it('names the B-UML export after the diagram, not the backend default', () => {
    expect(bumlExportFilename('Library System', 'ClassDiagram', 'attachment; filename="domain_model.py"')).toBe(
      'library_system.py',
    );
    expect(bumlExportFilename('Library System', 'ObjectDiagram', 'attachment; filename=domain_model.py')).toBe(
      'library_system_object.py',
    );
    expect(bumlExportFilename('Agents', 'AgentDiagram', 'attachment; filename="agent.zip"')).toBe('agents.zip');
    expect(bumlExportFilename('a/b: c?', 'ClassDiagram', null)).toBe('ab_c.py');
    expect(bumlExportFilename('   ', 'ClassDiagram', null)).toBe('exported_buml.py');
  });

  it('gives the white and the transparent PNG export different names', async () => {
    const editor = { exportAsSVG: vi.fn(async () => ({ svg: '<svg/>', clip: { width: 10, height: 10 } })) } as any;
    // jsdom has no canvas/image decoding: stub the conversion pipeline.
    const OriginalImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
    } as any;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), fillStyle: '',
    } as any);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => cb(new Blob(['x'])));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    try {
      const { result } = renderHook(() => useExportPNG());
      await result.current(editor, 'Shop', true);
      await result.current(editor, 'Shop', false);
      const names = download.mock.calls.map((call) => call[0].filename);
      expect(names).toHaveLength(2);
      expect(new Set(names).size).toBe(2);
      expect(names[0]).toBe('Shop.png');
    } finally {
      globalThis.Image = OriginalImage;
      getContext.mockRestore();
      toBlob.mockRestore();
    }
  });
});
