import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageCleanupDialog } from '../StorageCleanupDialog';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, type BesserProject } from '../../../shared/types/project';

const mockExportProject = vi.fn();
let mockCurrentProject: BesserProject | null = null;

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: mockCurrentProject, exportProject: mockExportProject }),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}));

function save(name: string, editedAt: string): BesserProject {
  const project = createDefaultProject(name, '', 'me');
  project.createdAt = '2019-01-01T00:00:00.000Z';
  for (const diagrams of Object.values(project.diagrams)) {
    for (const diagram of diagrams) diagram.lastUpdate = editedAt;
  }
  ProjectStorageRepository.saveProject(project);
  return project;
}

const rows = () => screen.getAllByTestId('storage-cleanup-row');
const rowFor = (name: string) => rows().find((row) => within(row).queryByText(name))!;

beforeEach(() => {
  localStorage.clear();
  mockExportProject.mockReset();
  vi.mocked(toast.success).mockReset();
});

describe('StorageCleanupDialog', () => {
  it('lists saved projects oldest first and keeps the open one unselectable', () => {
    save('Old', '2021-01-01T00:00:00.000Z');
    save('Older', '2020-01-01T00:00:00.000Z');
    mockCurrentProject = save('Current', '2024-01-01T00:00:00.000Z');

    render(<StorageCleanupDialog open onOpenChange={() => {}} />);

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Older'),
      expect.stringContaining('Old'),
      expect.stringContaining('Current'),
    ]);
    expect(within(rowFor('Current')).getByText('Open now')).toBeTruthy();
    expect(within(rowFor('Current')).getByRole('checkbox')).toBeDisabled();
    expect(within(rowFor('Old')).getByRole('checkbox')).not.toBeDisabled();
    expect(screen.getByTestId('storage-cleanup-delete')).toBeDisabled();
  });

  it('exports a project on request', () => {
    const old = save('Old', '2021-01-01T00:00:00.000Z');
    mockCurrentProject = save('Current', '2024-01-01T00:00:00.000Z');
    mockExportProject.mockResolvedValue(undefined);

    render(<StorageCleanupDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export project Old as JSON' }));

    expect(mockExportProject).toHaveBeenCalledWith(old.id, true);
  });

  it('deletes the selected projects only after the user confirms', async () => {
    const old = save('Old', '2021-01-01T00:00:00.000Z');
    const keep = save('Keep', '2022-01-01T00:00:00.000Z');
    mockCurrentProject = save('Current', '2024-01-01T00:00:00.000Z');

    render(<StorageCleanupDialog open onOpenChange={() => {}} />);
    fireEvent.click(within(rowFor('Old')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('storage-cleanup-delete'));

    // Cancelling the confirm deletes nothing.
    await screen.findByText('Delete 1 project?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Delete 1 project?')).toBeNull());
    expect(ProjectStorageRepository.loadProject(old.id)).not.toBeNull();

    fireEvent.click(screen.getByTestId('storage-cleanup-delete'));
    await screen.findByText('Delete 1 project?');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(ProjectStorageRepository.loadProject(old.id)).toBeNull());
    expect(ProjectStorageRepository.loadProject(keep.id)).not.toBeNull();
    expect(ProjectStorageRepository.loadProject(mockCurrentProject!.id)).not.toBeNull();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Deleted 1 project'));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });
});
