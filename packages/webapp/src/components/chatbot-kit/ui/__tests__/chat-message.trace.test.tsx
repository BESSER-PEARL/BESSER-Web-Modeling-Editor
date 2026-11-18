/**
 * The run card's trace view (#649): what each phase took, the validation
 * findings with the fix attempts between them, and, in "View files", which
 * lines the AI wrote and which came from a generator.
 */

import React from 'react';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../chat-message';
import { readGeneratedFiles } from '../generated-files-dialog';
import type { SpecDrivenMessageState, SpecDrivenPhaseView } from '@/main/features/spec-driven/types';

vi.mock('@/main/shared/utils/specDrivenDownload', () => ({
  fetchAndSaveSpecDrivenArtifact: vi.fn(() => Promise.resolve({ ok: true, sizeBytes: 42 })),
  fetchSpecDrivenArtifactBlob: vi.fn(),
}));

import { fetchSpecDrivenArtifactBlob } from '@/main/shared/utils/specDrivenDownload';

const RUN_ID = 'e8834aa911ae4049b5fa5c5af1357a13';
const IMPORT = "import [backend/main.py]: No module named 'routers.book'";
const SYNTAX = 'Syntax error in backend/models.py line 3: invalid syntax';

const PHASES: SpecDrivenPhaseView[] = [
  { phase: 'select', label: 'Selecting generator', message: 'Selecting generator', toolCalls: [],
    startedAt: { usd: 0, turns: 0, elapsedSeconds: 0 } },
  { phase: 'customize', label: 'Customising output', message: 'LLM customising generator output',
    toolCalls: [{ turn: 1, tool: 'read_file', detail: 'path=backend/main.py' }],
    startedAt: { usd: 0, turns: 0, elapsedSeconds: 4 } },
  {
    phase: 'validate', label: 'Validating', message: '2 blockers / 3 total',
    startedAt: { usd: 0.42, turns: 12, elapsedSeconds: 190 },
    toolCalls: [
      { turn: 13, tool: 'modify_file', detail: 'path=backend/main.py' },
      { turn: 14, tool: 'modify_file', detail: 'path=backend/models.py' },
    ],
    findings: [
      { attempt: 0, blockers: [IMPORT, SYNTAX], blockerCount: 2, issueCount: 3, restored: false, afterToolCalls: 0 },
      { attempt: 1, blockers: [SYNTAX], blockerCount: 1, issueCount: 1, restored: false, afterToolCalls: 1 },
      { attempt: 2, blockers: [], blockerCount: 0, issueCount: 0, restored: false, afterToolCalls: 2 },
    ],
  },
];

const card = (overrides: Partial<SpecDrivenMessageState> = {}): SpecDrivenMessageState => ({
  runId: RUN_ID,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  phases: PHASES,
  warnings: [],
  text: '',
  status: 'running',
  costUsd: 0.5,
  turns: 15,
  elapsedSeconds: 230,
  ...overrides,
});

// The row toggle's accessible name is its aria-label; its visible text says what it opens.
const toggle = (text: RegExp) =>
  screen.getAllByRole('button', { name: /show details/i }).find((b) => text.test(b.textContent ?? ''));

const renderCard = (specDriven: SpecDrivenMessageState) =>
  render(
    <ChatMessage id="m1" role="assistant" content="" specDriven={specDriven}
      isStreaming={specDriven.status === 'running'} />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('phase rows', () => {
  it('show how long each phase took and how many turns it used', () => {
    renderCard(card());
    const stats = screen.getAllByTestId('phase-stats').map((s) => s.textContent);
    expect(stats).toEqual(['4s', '3m 6s · 12 turns', '40s · 3 turns']);
  });

  it('add the estimated cost once the run has ended', () => {
    renderCard(card({ status: 'done', fileName: 'app.zip', isZip: true }));
    fireEvent.click(screen.getByRole('button', { name: /show steps/i }));
    const stats = screen.getAllByTestId('phase-stats').map((s) => s.textContent);
    expect(stats).toEqual(['4s', '3m 6s · 12 turns · ~$0.42', '40s · 3 turns · ~$0.08']);
  });
});

describe('findings and repairs', () => {
  it('reads as check, fix attempt, re-check on the validate row', () => {
    renderCard(card());
    fireEvent.click(toggle(/^2 fix attempts$/)!);
    const timeline = screen.getByTestId('repair-timeline');
    const rounds = within(timeline).getAllByTestId('findings-round');
    expect(rounds[0].textContent).toContain('First check');
    expect(rounds[0].textContent).toContain('2 blockers of 3 findings');
    expect(rounds[0].textContent).toContain(IMPORT);
    expect(within(timeline).getByText('Fix attempt 1')).toBeTruthy();
    expect(within(rounds[1]).getByText('fixed')).toBeTruthy();
    expect(within(rounds[1]).getByText('still failing')).toBeTruthy();
    expect(rounds[2].textContent).toContain('Re-check after fix attempt 2');
    expect(rounds[2].textContent).toContain('no blockers');
  });

  it('keeps the plain action list for a row without findings', () => {
    renderCard(card());
    expect(toggle(/^1 action$/)).toBeTruthy();
  });
});

// Shaped like run t2-a4's record (2026-11-17): generators are `unknown` with a generator link.
const MAIN = 'from fastapi import FastAPI\n\napp = FastAPI()\napp.include_router(books)\n';
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const RECORD = {
  version: '0.1',
  timestamp: '2026-11-17T20:00:00+00:00',
  files: [{
    path: 'backend/main.py',
    conversations: [
      { contributor: { type: 'unknown' },
        ranges: [{ start_line: 1, end_line: 3, content_hash: hash('from fastapi import FastAPI\n\napp = FastAPI()') }],
        related: [{ type: 'generator', url: 'urn:besser:generator:generate_fastapi_backend@8.10.1' }] },
      { contributor: { type: 'ai', model_id: 'anthropic/claude-sonnet-5-5' },
        ranges: [{ start_line: 4, end_line: 4, content_hash: hash('app.include_router(books)') }] },
    ],
  }],
  metadata: { 'org.besser-pearl': { run_id: RUN_ID } },
};

async function zipOf(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'blob' });
}

describe('View files: who wrote which lines', () => {
  it('marks AI and generator lines, per file and in the tree', async () => {
    vi.mocked(fetchSpecDrivenArtifactBlob).mockResolvedValue(await zipOf({
      'README.md': '# App\n',
      'backend/main.py': MAIN,
      [`.agent-trace/${RUN_ID}.json`]: JSON.stringify(RECORD),
    }));
    renderCard(card({ status: 'done', fileName: 'app.zip', isZip: true }));
    fireEvent.click(screen.getByRole('button', { name: /view files/i }));

    expect(await screen.findByText(/AI wrote 25% of the lines/)).toBeTruthy();
    const mainButton = screen.getByRole('button', { name: /main\.py/ });
    expect(within(mainButton).getByText('AI')).toBeTruthy();
    fireEvent.click(mainButton);

    const legend = await screen.findByRole('list', { name: /who wrote these lines/i });
    expect(legend.textContent).toContain('AI 1');
    expect(legend.textContent).toContain('Generator 3');
    const bar = screen.getByTestId('authorship-bar');
    expect([...bar.children].map((c) => c.getAttribute('data-author'))).toEqual(['generator', 'ai']);
  });

  it('shows no colours for a file that changed after the record was written', async () => {
    vi.mocked(fetchSpecDrivenArtifactBlob).mockResolvedValue(await zipOf({
      'backend/main.py': MAIN.replace('FastAPI()', 'FastAPI(title="x")'),
      [`.agent-trace/${RUN_ID}.json`]: JSON.stringify(RECORD),
    }));
    renderCard(card({ status: 'done', fileName: 'app.zip', isZip: true }));
    fireEvent.click(screen.getByRole('button', { name: /view files/i }));
    fireEvent.click(await screen.findByRole('button', { name: /main\.py/ }));
    expect(await screen.findByText(/changed after the run recorded who wrote it/i)).toBeTruthy();
    expect(screen.queryByTestId('authorship-bar')).toBeNull();
  });
});

describe('readGeneratedFiles', () => {
  it('reads a large app\'s trace record past the preview size cap', async () => {
    const big = JSON.stringify({ ...RECORD, padding: 'x'.repeat(600 * 1024) });
    const { files } = await readGeneratedFiles(await zipOf({
      'app/backend/main.py': MAIN,
      [`app/.agent-trace/${RUN_ID}.json`]: big,
      'app/huge.json': big,
    }), 'app.zip');
    expect(files.find((f) => f.path === `.agent-trace/${RUN_ID}.json`)!.text).not.toBeNull();
    expect(files.find((f) => f.path === 'huge.json')!.text).toBeNull();
  });
});
