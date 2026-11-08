/**
 * A deterministic generator's output is stored as a run before the push dialog
 * opens, since the dialog pushes a server-side run (BESSER-PEARL/BESSER#748).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
const reportError = vi.hoisted(() => vi.fn());
const info = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock('../../analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../analytics/events')>()),
  track,
}));
vi.mock('../../errors/reportError', () => ({ reportError }));
vi.mock('react-toastify', () => ({ toast: { info, success: vi.fn() } }));
vi.mock('../../../api/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/api-client')>()),
  apiClient: { upload },
}));

import { ApiError } from '../../../api/api-client';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '../githubAuth';
import { storeGeneratedCodeForPush } from '../saveGeneratedCode';

const SESSION = 's'.repeat(20);
const SQL = new Blob(['CREATE TABLE book (id INTEGER);\n'], { type: 'application/sql' });

afterEach(() => {
  resetGitHubAuthForTests();
  vi.clearAllMocks();
});

describe('storeGeneratedCodeForPush', () => {
  it('uploads the file under its name with the GitHub session and returns the run id', async () => {
    signInToGitHubForTests(SESSION);
    upload.mockResolvedValue({ run_id: 'b'.repeat(32) });

    await expect(storeGeneratedCodeForPush(SQL, 'library.sql')).resolves.toBe('b'.repeat(32));

    const [path, form, options] = upload.mock.calls[0];
    expect(path).toBe('/spec-driven/import-generated-code');
    const file = (form as FormData).get('file') as File;
    expect(file.name).toBe('library.sql');
    expect(file.size).toBe(SQL.size);
    expect(options).toMatchObject({ headers: { 'X-GitHub-Session': SESSION } });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('asks to connect GitHub first without uploading, as signing in reloads the page', async () => {
    await expect(storeGeneratedCodeForPush(SQL, 'library.sql')).resolves.toBeNull();

    expect(upload).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/connect github/i));
    expect(track).toHaveBeenCalledWith('github_push_failed', { code: 'no_session' });
  });

  it('reports an upload the server refused', async () => {
    signInToGitHubForTests(SESSION);
    upload.mockRejectedValue(new ApiError(413, 'The generated code is too large to save to GitHub.'));

    await expect(storeGeneratedCodeForPush(SQL, 'library.sql')).resolves.toBeNull();

    expect(reportError).toHaveBeenCalledWith(expect.stringContaining('too large'), expect.anything());
    expect(track).toHaveBeenCalledWith('github_push_failed', expect.objectContaining({ code: 'upload_failed' }));
  });

  it('reports an expired session as one', async () => {
    signInToGitHubForTests(SESSION);
    upload.mockRejectedValue(new ApiError(401, 'GitHub session expired. Please sign in again.'));

    await expect(storeGeneratedCodeForPush(SQL, 'library.sql')).resolves.toBeNull();

    expect(reportError).toHaveBeenCalledWith(expect.stringMatching(/session expired/i), expect.anything());
    expect(track).toHaveBeenCalledWith('github_push_failed', expect.objectContaining({ code: 'auth' }));
  });
});
