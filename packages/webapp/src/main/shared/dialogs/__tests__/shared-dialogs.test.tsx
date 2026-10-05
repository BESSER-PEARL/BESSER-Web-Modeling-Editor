import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../i18n';
import { FeedbackDialog } from '../FeedbackDialog';
import { HelpGuideDialog } from '../HelpGuideDialog';
import { KeyboardShortcutsDialog } from '../KeyboardShortcutsDialog';

afterEach(cleanup);

describe('KeyboardShortcutsDialog', () => {
  it('uses sentence-case section labels and does not focus the close button on open', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: i18n.t('dialogs.shortcuts.category.general') });
    expect(heading.className).not.toContain('uppercase');
    expect(screen.getByRole('button', { name: 'Close' })).not.toHaveFocus();
  });
});

describe('HelpGuideDialog', () => {
  it('lists all nine diagram types, including BPMN and User diagrams', () => {
    render(<HelpGuideDialog open onOpenChange={vi.fn()} />);
    const nav = screen.getByText(i18n.t('dialogs.guide.diagramTypesHeading')).closest('aside') as HTMLElement;
    expect(nav.querySelector('p')?.className).not.toContain('uppercase');
    expect(within(nav).getAllByRole('button')).toHaveLength(9);

    fireEvent.click(within(nav).getByRole('button', { name: i18n.t('dialogs.guide.bpmn.label') }));
    expect(screen.getByText(i18n.t('dialogs.guide.bpmn.buildProcess.title'))).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('button', { name: i18n.t('dialogs.guide.user.label') }));
    expect(screen.getByText(i18n.t('dialogs.guide.user.editAsForm.title'))).toBeInTheDocument();
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
});
