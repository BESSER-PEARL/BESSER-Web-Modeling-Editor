import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelpMenu } from '../menus/HelpMenu';

describe('HelpMenu', () => {
  const renderMenu = () =>
    render(
      <TooltipProvider>
        <HelpMenu
          outlineButtonClass=""
          onOpenHelpDialog={vi.fn()}
          onOpenAboutDialog={vi.fn()}
          onOpenKeyboardShortcuts={vi.fn()}
          onOpenFeedback={vi.fn()}
        />
      </TooltipProvider>,
    );
  const renderOpen = () => {
    renderMenu();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Help' }), { key: 'ArrowDown' });
  };

  it('renders community links as real external anchors', () => {
    renderOpen();
    const repo = screen.getByRole('menuitem', { name: 'GitHub Repository' });
    expect(repo.tagName).toBe('A');
    expect(repo).toHaveAttribute('href', 'https://github.com/BESSER-PEARL/BESSER');
    expect(repo).toHaveAttribute('target', '_blank');
    expect(repo).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('gives every item an icon', () => {
    renderOpen();
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });

  it('names the icon-only trigger with aria-label instead of title', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Help' });
    expect(trigger).toHaveAttribute('aria-label', 'Help');
    expect(trigger).not.toHaveAttribute('title');
  });
});
