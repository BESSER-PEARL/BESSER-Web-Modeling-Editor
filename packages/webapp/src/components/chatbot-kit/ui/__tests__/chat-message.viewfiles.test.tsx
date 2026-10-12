/**
 * The run card's action list (verb + target from the streamed `detail`) and
 * the "View files" project browser on a finished run.
 */

import React from 'react';
import JSZip from 'jszip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage, type SpecDrivenMessageState } from '../chat-message';
import { readGeneratedFiles } from '../generated-files-dialog';

vi.mock('@/main/shared/utils/specDrivenDownload', () => ({
  fetchAndSaveSpecDrivenArtifact: vi.fn(() => Promise.resolve({ ok: true, sizeBytes: 42 })),
  fetchSpecDrivenArtifactBlob: vi.fn(),
}));

import {
  fetchAndSaveSpecDrivenArtifact,
  fetchSpecDrivenArtifactBlob,
} from '@/main/shared/utils/specDrivenDownload';

const RUN_ID = 'a'.repeat(32);

// jsdom's Blob has no text(); every browser the editor supports does.
if (!Blob.prototype.text) {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(this);
    });
  };
}

const CUSTOMIZE = {
  phase: 'customize',
  label: 'Customising output',
  message: 'LLM customising generator output',
  toolCalls: [
    { turn: 1, tool: 'read_file', detail: 'path=backend/main_api.py batched=2' },
    { turn: 2, tool: 'run_command', detail: 'command=node --version' },
    { turn: 3, tool: 'write_file', detail: 'path=frontend/src/App.jsx' },
  ],
};

function card(overrides: Partial<SpecDrivenMessageState> = {}): SpecDrivenMessageState {
  return {
    runId: RUN_ID,
    provider: 'free',
    model: 'moonshotai/Kimi-K3',
    phases: [CUSTOMIZE],
    warnings: [],
    text: '',
    status: 'running',
    ...overrides,
  };
}

const renderCard = (specDriven: SpecDrivenMessageState) =>
  render(
    <ChatMessage
      id="m1"
      role="assistant"
      content=""
      specDriven={specDriven}
      isStreaming={specDriven.status === 'running'}
    />,
  );

async function zipOf(files: Record<string, string | Uint8Array>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'blob' });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Customising output — action rows', () => {
  it('names each action by verb and target, not by raw tool name', () => {
    renderCard(card());
    fireEvent.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByText('backend/main_api.py')).toBeTruthy();
    expect(screen.getByText('node --version')).toBeTruthy();
    expect(screen.getAllByText('write').length).toBeGreaterThan(0);
    expect(screen.queryByText('write_file')).toBeNull();
  });

  it('shows the action in flight under the Working strip', () => {
    renderCard(card());
    // Visible without expanding the phase: the latest call is the ticker.
    expect(screen.getByText('frontend/src/App.jsx')).toBeTruthy();
  });
});

describe('View files', () => {
  const done = (overrides: Partial<SpecDrivenMessageState> = {}) =>
    card({
      status: 'done',
      fileName: 'hotel_booking.zip',
      isZip: true,
      generatorUsed: 'generate_fastapi_backend',
      ...overrides,
    });

  it('opens the generated project in a file browser without downloading it', async () => {
    vi.mocked(fetchSpecDrivenArtifactBlob).mockResolvedValue(
      await zipOf({
        'hotel_booking/README.md': '# Hotel booking\n',
        'hotel_booking/backend/main_api.py': 'import fastapi\n',
      }),
    );
    renderCard(done());

    fireEvent.click(screen.getByRole('button', { name: /view files/i }));

    expect(await screen.findByText('hotel_booking/')).toBeTruthy();
    expect(fetchSpecDrivenArtifactBlob).toHaveBeenCalledWith(RUN_ID);
    expect(fetchAndSaveSpecDrivenArtifact).not.toHaveBeenCalled();
    // README opens first.
    expect(await screen.findByText(/# Hotel booking/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /main_api\.py/ }));
    await waitFor(() =>
      expect(document.querySelector('.gfd-code code')?.textContent).toBe('import fastapi\n'),
    );
  });

  it('keeps an intra-word underscore from colouring the rest of a README', async () => {
    // Real README from run 7d2582f6: hljs's markdown grammar opened emphasis
    // at `Class_Diagram` and closed it 20 lines later at `main_api.py`.
    vi.mocked(fetchSpecDrivenArtifactBlob).mockResolvedValue(
      await zipOf({ 'p/README.md': '# Class_Diagram\n\nA backend.\n\ncd backend && python main_api.py\n' }),
    );
    renderCard(done());
    fireEvent.click(screen.getByRole('button', { name: /view files/i }));
    await screen.findByText('p/');
    const code = document.querySelector('.gfd-code code')!;
    expect(code.querySelector('.hljs-section')?.textContent).toBe('# Class_Diagram');
    expect(code.querySelector('.hljs-emphasis')).toBeNull();
  });

  it('explains when the files are gone from the server', async () => {
    vi.mocked(fetchSpecDrivenArtifactBlob).mockResolvedValue(null);
    renderCard(done());
    fireEvent.click(screen.getByRole('button', { name: /view files/i }));
    expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
  });

  it('uses the blob in hand for a deterministic run', async () => {
    renderCard(
      done({
        runId: undefined,
        deterministic: true,
        deterministicBlob: await zipOf({ 'app/README.md': 'hello' }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /view files/i }));
    expect(await screen.findByText('app/')).toBeTruthy();
    expect(fetchSpecDrivenArtifactBlob).not.toHaveBeenCalled();
  });

  it('is not offered while the run is still going', () => {
    renderCard(card());
    expect(screen.queryByRole('button', { name: /view files/i })).toBeNull();
  });
});

describe('readGeneratedFiles', () => {
  it('lifts a shared top folder into the root and flags binary files', async () => {
    const { root, files } = await readGeneratedFiles(
      await zipOf({ 'p/a.txt': 'x', 'p/img.png': new Uint8Array([137, 80, 0, 1]) }),
      'p.zip',
    );
    expect(root).toBe('p');
    expect(files.map((f) => f.path)).toEqual(['a.txt', 'img.png']);
    expect(files[1].text).toBeNull();
  });

  it('shows a non-zip artifact as the single file it is', async () => {
    const { root, files } = await readGeneratedFiles(new Blob(['print(1)']), 'main.py');
    expect(root).toBe('');
    expect(files).toEqual([{ path: 'main.py', size: 8, text: 'print(1)' }]);
  });
});
