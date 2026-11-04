import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../i18n';
import { FeedbackDialog } from '../FeedbackDialog';
import { HelpGuideDialog } from '../HelpGuideDialog';
import { KeyboardShortcutsDialog } from '../KeyboardShortcutsDialog';

const mockCapture = vi.fn();
const mockSubmitFeedback = vi.fn();
vi.mock('../../services/analytics/lazy-analytics', () => ({
  captureEvent: (...args: unknown[]) => mockCapture(...args),
  getSentry: () => null,
}));
vi.mock('../../api/feedback', () => ({ submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args) }));

afterEach(() => {
  cleanup();
  mockCapture.mockReset();
  mockSubmitFeedback.mockReset();
});

// Radix renders a hidden bubble input (sized via ResizeObserver) for radio groups inside a <form>.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('KeyboardShortcutsDialog', () => {
  it('uses sentence-case section labels and does not focus the close button on open', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: i18n.t('dialogs.shortcuts.category.general') });
    expect(heading.className).not.toContain('uppercase');
    expect(screen.getByRole('button', { name: 'Close' })).not.toHaveFocus();
  });
});

describe('HelpGuideDialog', () => {
  it('lists all nine diagram types, including BPMN and User diagrams, then the project sections', () => {
    render(<HelpGuideDialog open onOpenChange={vi.fn()} />);
    const nav = screen.getByText(i18n.t('dialogs.guide.diagramTypesHeading')).closest('aside') as HTMLElement;
    expect(nav.querySelector('p')?.className).not.toContain('uppercase');
    expect(within(nav).getAllByRole('button')).toHaveLength(10);
    expect(within(nav).getByText(i18n.t('dialogs.guide.projectHeading'))).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('button', { name: i18n.t('dialogs.guide.bpmn.label') }));
    expect(screen.getByText(i18n.t('dialogs.guide.bpmn.buildProcess.title'))).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('button', { name: i18n.t('dialogs.guide.user.label') }));
    expect(screen.getByText(i18n.t('dialogs.guide.user.editAsForm.title'))).toBeInTheDocument();
  });

  it('explains GitHub: what is saved, merging, pull requests and the AI reading of a repo', () => {
    render(<HelpGuideDialog open onOpenChange={vi.fn()} initialSection="github" />);

    expect(screen.getByRole('button', { name: 'GitHub' })).toHaveAttribute('aria-pressed', 'true');
    for (const detail of ['connect', 'repoContents', 'saveLatest', 'pullRequests', 'history', 'anyRepo', 'publish']) {
      expect(screen.getByText(i18n.t(`dialogs.guide.github.${detail}.title`))).toBeInTheDocument();
    }
    expect(screen.getByText('buml/diagrams.json')).toBeInTheDocument();
    // Nothing is read with AI before the user agrees.
    expect(screen.getByText(/it asks you first\. Only if you agree/)).toBeInTheDocument();
    expect(screen.getByText(/removed before anything is written/)).toBeInTheDocument();
  });
});

describe('FeedbackDialog', () => {
  it('uses a labelled radio group and a labelled select, without uppercase labels', () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: i18n.t('feedback.satisfactionQuestion') });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    fireEvent.click(radios[2]);
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');

    const category = screen.getByRole('combobox', { name: i18n.t('feedback.category') });
    expect(category.tagName).toBe('BUTTON');

    for (const label of [screen.getByText(i18n.t('feedback.satisfactionQuestion')), screen.getByText(i18n.t('feedback.category'))]) {
      expect(label.className).not.toContain('uppercase');
    }
  });

  const fillAndSend = () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: i18n.t('feedback.satisfactionQuestion') });
    fireEvent.click(within(group).getAllByRole('radio')[2]);
    fireEvent.change(screen.getByRole('textbox', { name: new RegExp(i18n.t('feedback.feedbackLabel'), 'i') }), {
      target: { value: 'The private feedback text that must never be sent anywhere else' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('feedback.submit') }));
  };

  it('reports a failed submission by error kind only, never the text', async () => {
    mockSubmitFeedback.mockRejectedValue(new TypeError('Failed to fetch'));
    fillAndSend();
    await vi.waitFor(() => expect(mockCapture).toHaveBeenCalledWith('feedback_failed', expect.anything()));
    expect(mockCapture).toHaveBeenCalledWith('feedback_failed', { reason: 'request', error_type: 'TypeError', network_error: true });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain('private feedback');
  });

  it('reports a sent feedback with its rating and no content', async () => {
    mockSubmitFeedback.mockResolvedValue(undefined);
    fillAndSend();
    await vi.waitFor(() => expect(mockCapture).toHaveBeenCalledWith('feedback_submitted', expect.anything()));
    const [, props] = mockCapture.mock.calls.find(([event]) => event === 'feedback_submitted')!;
    expect(props).toMatchObject({ has_email: false });
    expect(JSON.stringify(props)).not.toContain('private feedback');
  });
});
