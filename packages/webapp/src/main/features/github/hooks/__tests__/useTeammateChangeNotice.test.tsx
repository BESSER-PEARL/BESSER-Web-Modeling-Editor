import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.hoisted(() =>
  Object.assign(vi.fn(), { dismiss: vi.fn(), update: vi.fn(), isActive: vi.fn(() => false) }),
);
vi.mock('react-toastify', () => ({ toast: toastSpy, Slide: {} }));

import { teammateChange, useTeammateChangeNotice } from '../useTeammateChangeNotice';

const link = { owner: 'ana', repo: 'grand-hotel', branch: 'main' };
const commit = (author: string, message: string, origin: string | null = 'editor') => ({
  sha: 'c'.repeat(40), message, author, date: '', html_url: '', origin,
});
const status = (head: string, ...commits: ReturnType<typeof commit>[]) => ({
  head_sha: head.repeat(40), commits_since: commits, in_sync: false, pending: null,
});
const ADD_REVIEW = 'Add Review\n\nBESSER-Origin: editor';

type Props = Parameters<typeof useTeammateChangeNotice>[0];
const onAction = vi.fn();
const notice = (overrides: Partial<Props> = {}): Props => ({
  link,
  status: status('a', commit('ben', ADD_REVIEW)),
  state: 'behind',
  username: 'ana',
  hasLocalChanges: false,
  onAction,
  ...overrides,
});
const mount = (props: Props) => renderHook((p: Props) => useTeammateChangeNotice(p), { initialProps: props });
const shownCard = () => toastSpy.mock.calls[0][0] as React.ReactElement;

beforeEach(() => {
  vi.clearAllMocks();
  toastSpy.isActive.mockReturnValue(false);
});

describe('teammateChange', () => {
  it('names the newest commit someone else made and counts the rest', () => {
    expect(teammateChange([commit('Ana', 'Mine'), commit('ben', ADD_REVIEW), commit('ben', 'Older')], 'ana')).toEqual({
      author: 'ben', subject: 'Add Review', changedModel: true, moreCommits: 2,
    });
  });

  it("says nothing about the user's own commits", () => {
    expect(teammateChange([commit('ana', 'From my other laptop')], 'ana')).toBeNull();
  });
});

describe('useTeammateChangeNotice', () => {
  it('says who changed the model and takes the change in on one click', () => {
    mount(notice());

    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0][1]).toMatchObject({ autoClose: false, toastId: 'github-teammate-change' });
    render(shownCard());
    expect(screen.getByText('ben changed the model')).toBeInTheDocument();
    expect(screen.getByText('Add Review')).toBeInTheDocument();
    expect(screen.queryByText(/BESSER-Origin/)).toBeNull();
    expect(screen.getByText('ana/grand-hotel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Get latest' }));
    expect(onAction).toHaveBeenCalledWith('getLatest');
  });

  it('does not claim a code-only commit changed the model', () => {
    mount(notice({ status: status('a', commit('ben', 'Fix the footer', null)) }));

    render(shownCard());
    expect(screen.getByText('ben pushed to main')).toBeInTheDocument();
  });

  it('offers a merge, not a replacement, when the user has unsaved edits', () => {
    mount(notice({ state: 'diverged', hasLocalChanges: true }));

    render(shownCard());
    expect(screen.queryByRole('button', { name: 'Get latest' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save and merge' }));
    expect(onAction).toHaveBeenCalledWith('save');
  });

  it('does not come back for the same commit once dismissed, but does for a newer one', () => {
    const { rerender } = mount(notice());
    rerender(notice({ status: status('a', commit('ben', ADD_REVIEW)) }));
    expect(toastSpy).toHaveBeenCalledTimes(1);

    rerender(notice({ status: status('b', commit('ben', 'Add Spa'), commit('ben', ADD_REVIEW)) }));
    expect(toastSpy).toHaveBeenCalledTimes(2);
  });

  it('updates the open card when another commit arrives or the user starts editing', () => {
    const { rerender } = mount(notice());
    toastSpy.isActive.mockReturnValue(true);

    const newer = status('b', commit('ben', 'Add Spa'), commit('ben', ADD_REVIEW));
    rerender(notice({ status: newer }));
    rerender(notice({ status: newer, hasLocalChanges: true }));

    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.update).toHaveBeenCalledTimes(2);
  });

  it('closes once the project is in sync', () => {
    const { rerender } = mount(notice());
    toastSpy.dismiss.mockClear();

    rerender(notice({ state: 'in-sync', status: { ...status('b'), in_sync: true } }));

    expect(toastSpy.dismiss).toHaveBeenCalledWith('github-teammate-change');
  });

  it("stays quiet for the user's own commits", () => {
    mount(notice({ status: status('a', commit('ana', 'From my other laptop')) }));
    expect(toastSpy).not.toHaveBeenCalled();
  });
});
