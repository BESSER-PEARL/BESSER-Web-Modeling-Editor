import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageQuotaWarning } from '../StorageQuotaWarning';
import { STORAGE_QUOTA_WARNING_EVENT } from '../../../shared/services/storage/localStorageQuota';

vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn(), dismiss: vi.fn() },
}));
vi.mock('../../../features/project/StorageCleanupDialog', () => ({
  StorageCleanupDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="cleanup-dialog" /> : null),
}));

beforeEach(() => {
  vi.mocked(toast.warning).mockReset();
});

describe('StorageQuotaWarning', () => {
  it('warns with the usage, says how to free space and opens the cleanup dialog', async () => {
    render(<StorageQuotaWarning />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(STORAGE_QUOTA_WARNING_EVENT, {
          detail: { usageBytes: 4.3 * 1024 * 1024, limitBytes: 5 * 1024 * 1024 },
        }),
      );
    });

    expect(toast.warning).toHaveBeenCalledTimes(1);
    const [content, options] = vi.mocked(toast.warning).mock.calls[0];
    expect(options).toMatchObject({ toastId: 'localStorage-quota-warning' });

    render(<>{content as React.ReactNode}</>);
    expect(screen.getByText('Browser storage is nearly full (4.3 MB of 5 MB).')).toBeTruthy();
    expect(screen.getByText(/delete projects you no longer use/).textContent).toContain('File › Open Project…');

    fireEvent.click(screen.getByRole('button', { name: 'Free up space' }));
    expect(toast.dismiss).toHaveBeenCalledWith('localStorage-quota-warning');
    expect(await screen.findByTestId('cleanup-dialog')).toBeTruthy();
  });
});
