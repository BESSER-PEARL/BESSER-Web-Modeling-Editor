import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';
import {
  createLabChange,
  createLabNote,
  deleteLabNote,
  getLabMemory,
  updateLabNote,
  type LabChangeDetail,
  type LabNote,
} from '../../../shared/api/lab';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import { LabMemoryPanel } from '../LabMemoryPanel';

const SESSION = 'gh-session-0123456789';
const NOW = Date.now() / 1000;

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), update: vi.fn() } }));
vi.mock('../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));
vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabMemory: vi.fn(),
  createLabNote: vi.fn(),
  updateLabNote: vi.fn(),
  deleteLabNote: vi.fn(),
  createLabChange: vi.fn(),
}));

function note(overrides: Partial<LabNote>): LabNote {
  return {
    id: 'm1',
    kind: 'decision',
    title: 'Generators write through _write_traced',
    body: 'Every generator writes its files through _write_traced so the trace sees them.',
    repos: ['besser'],
    changeKinds: ['generator'],
    docsTarget: '',
    sourceChange: '0123456789ab',
    sourceUrl: '',
    approvedBy: 'jordi',
    createdAt: NOW - 86400,
    updatedAt: NOW - 86400,
    lastReadAt: NOW - 3600,
    reads: 4,
    stale: false,
    ...overrides,
  };
}

const DECISION = note({});
const CONVENTION = note({
  id: 'm2',
  kind: 'convention',
  title: 'Run ruff before the checks',
  body: 'The quick checks fail on lint first; run ruff check besser/ before them.',
  repos: [],
  changeKinds: [],
  docsTarget: 'CLAUDE.md',
  approvedBy: 'ana',
  reads: 0,
  lastReadAt: 0,
  stale: true,
});

/** What the change route received: its id and the router state. */
const ChangeProbe: React.FC = () => {
  const location = useLocation();
  return <pre data-testid="change-probe">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>;
};

async function renderPanel() {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<LabMemoryPanel githubSession={SESSION} />} />
        <Route path="/c/:changeId" element={<ChangeProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('lab-memory-panel');
}

const rows = () => screen.getAllByTestId('lab-memory-note');

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(getLabMemory)
    .mockReset()
    .mockResolvedValue({ enabled: true, reason: '', notes: [DECISION, CONVENTION] });
  vi.mocked(createLabNote).mockReset();
  vi.mocked(updateLabNote).mockReset();
  vi.mocked(deleteLabNote).mockReset();
  vi.mocked(createLabChange).mockReset();
  vi.mocked(globalConfirm).mockReset();
});
afterEach(cleanup);

describe('LabMemoryPanel', () => {
  it('lists the notes with kind, title, scope, approver, reads and the stale flag', async () => {
    await renderPanel();
    expect(getLabMemory).toHaveBeenCalledWith(SESSION);
    const [decision, convention] = rows();
    expect(decision).toHaveTextContent('Decision');
    expect(decision).toHaveTextContent('Generators write through _write_traced');
    expect(decision).toHaveTextContent('BESSER');
    expect(within(decision).getByText('generator')).toBeInTheDocument();
    expect(decision).toHaveTextContent('Approved by @jordi');
    expect(decision).toHaveTextContent('Read 4 times');
    expect(within(decision).queryByTestId('lab-memory-stale')).toBeNull();
    expect(within(decision).queryByRole('button', { name: 'Move to docs' })).toBeNull();

    expect(convention).toHaveTextContent('Convention');
    expect(convention).toHaveTextContent('Every repository');
    expect(convention).toHaveTextContent('Every kind');
    expect(convention).toHaveTextContent('Never read');
    expect(within(convention).getByTestId('lab-memory-stale')).toHaveTextContent('Not read for a long time');
    expect(convention).toHaveTextContent('Belongs in CLAUDE.md');
  });

  it('says "Read once" for a note read by one change', async () => {
    vi.mocked(getLabMemory).mockResolvedValue({ enabled: true, reason: '', notes: [note({ reads: 1 })] });
    await renderPanel();
    expect(rows()[0]).toHaveTextContent('Read once');
  });

  it('edits a note and shows the saved version', async () => {
    vi.mocked(updateLabNote).mockResolvedValue({
      ...DECISION,
      title: 'Generators always use _write_traced',
      repos: ['besser', 'frontend'],
    });
    await renderPanel();
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Edit' }));
    const form = screen.getByTestId('lab-memory-form');
    expect(within(form).getByLabelText('Body')).toHaveValue(DECISION.body);
    fireEvent.change(within(form).getByLabelText('Title'), {
      target: { value: 'Generators always use _write_traced' },
    });
    fireEvent.click(within(form).getByRole('checkbox', { name: 'Web editor' }));
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    });
    expect(updateLabNote).toHaveBeenCalledWith(SESSION, 'm1', {
      kind: 'decision',
      title: 'Generators always use _write_traced',
      body: DECISION.body,
      repos: ['besser', 'frontend'],
      changeKinds: ['generator'],
      docsTarget: '',
    });
    expect(screen.queryByTestId('lab-memory-form')).toBeNull();
    expect(rows()[0]).toHaveTextContent('Generators always use _write_traced');
    expect(rows()[0]).toHaveTextContent('Web editor');
  });

  it("keeps the form open with the server's refusal when a save fails", async () => {
    vi.mocked(updateLabNote).mockRejectedValue(new ApiError(409, 'The team memory is full (60 notes).'));
    await renderPanel();
    fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Edit' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(within(screen.getByTestId('lab-memory-form')).getByRole('alert')).toHaveTextContent(
      'The team memory is full (60 notes).',
    );
  });

  it('writes a new note', async () => {
    const created = note({
      id: 'm3',
      kind: 'mistake',
      title: 'Do not mock the registry',
      body: 'Use the real one.',
      repos: [],
      changeKinds: [],
    });
    vi.mocked(createLabNote).mockResolvedValue(created);
    await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    const form = screen.getByTestId('lab-memory-form');
    fireEvent.change(within(form).getByLabelText('Kind'), { target: { value: 'mistake' } });
    fireEvent.change(within(form).getByLabelText('Title'), { target: { value: 'Do not mock the registry' } });
    fireEvent.change(within(form).getByLabelText('Body'), { target: { value: 'Use the real one.' } });
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    });
    expect(createLabNote).toHaveBeenCalledWith(SESSION, {
      kind: 'mistake',
      title: 'Do not mock the registry',
      body: 'Use the real one.',
      repos: [],
      changeKinds: [],
      docsTarget: '',
    });
    expect(rows()).toHaveLength(3);
    expect(rows()[2]).toHaveTextContent('Do not mock the registry');
  });

  it('deletes a note after the confirmation, and keeps it when cancelled', async () => {
    vi.mocked(deleteLabNote).mockResolvedValue(undefined);
    await renderPanel();

    vi.mocked(globalConfirm).mockResolvedValueOnce(false);
    await act(async () => {
      fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Delete' }));
    });
    expect(deleteLabNote).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(2);

    vi.mocked(globalConfirm).mockResolvedValueOnce(true);
    await act(async () => {
      fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Delete' }));
    });
    expect(globalConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Delete the note ‘Generators write through _write_traced’?',
        variant: 'danger',
      }),
    );
    expect(deleteLabNote).toHaveBeenCalledWith(SESSION, 'm1');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Run ruff before the checks');
  });

  it('reports a failed delete and keeps the note', async () => {
    vi.mocked(globalConfirm).mockResolvedValue(true);
    vi.mocked(deleteLabNote).mockRejectedValue(new ApiError(404, 'No note m1.'));
    await renderPanel();
    await act(async () => {
      fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Delete' }));
    });
    expect(toast.error).toHaveBeenCalledWith('The note could not be deleted: No note m1.');
    expect(rows()).toHaveLength(2);
  });

  it("shows the server's reason when the team memory is off, and no controls", async () => {
    vi.mocked(getLabMemory).mockResolvedValue({
      enabled: false,
      reason:
        'The state folder /srv/lab/state is inside the workspace root /srv/lab; set BESSER_LAB_STATE_DIR outside it.',
      notes: [],
    });
    await renderPanel();
    expect(screen.getByTestId('lab-memory-disabled')).toHaveTextContent(
      'Team notes are off: The state folder /srv/lab/state is inside the workspace root /srv/lab; set BESSER_LAB_STATE_DIR outside it.',
    );
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull();
    expect(screen.queryAllByTestId('lab-memory-note')).toHaveLength(0);
  });

  it('says why the notes could not be read', async () => {
    vi.mocked(getLabMemory).mockRejectedValueOnce(new ApiError(500, 'notes.json is not valid JSON'));
    await renderPanel();
    expect(screen.getByTestId('lab-memory-error')).toHaveTextContent(
      'The team notes could not be read: notes.json is not valid JSON',
    );
  });

  it('moves a note to its docs target through a new change', async () => {
    vi.mocked(createLabChange).mockResolvedValue({ changeId: 'feedfacecafe' } as LabChangeDetail);
    await renderPanel();
    await act(async () => {
      fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Move to docs' }));
    });
    expect(createLabChange).toHaveBeenCalledWith(SESSION);
    const probe = JSON.parse(screen.getByTestId('change-probe').textContent ?? '');
    expect(probe.path).toBe('/c/feedfacecafe');
    const message: string = probe.state.labStart.message;
    expect(Object.keys(probe.state.labStart)).toEqual(['message']);
    expect(message).toContain('CLAUDE.md');
    expect(message).toContain('Run ruff before the checks');
    expect(message).toContain(CONVENTION.body);
  });

  it("shows the server's refusal when the change for the docs cannot be created", async () => {
    vi.mocked(createLabChange).mockRejectedValue(new ApiError(409, 'You have used your budget.'));
    await renderPanel();
    await act(async () => {
      fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Move to docs' }));
    });
    expect(toast.error).toHaveBeenCalledWith('The change could not be started: You have used your budget.');
    expect(screen.queryByTestId('change-probe')).toBeNull();
  });
});
