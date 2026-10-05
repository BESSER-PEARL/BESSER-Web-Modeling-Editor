import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import { HelpMenu } from '../menus/HelpMenu';
import { MobileNavigation } from '../menus/MobileNavigation';

describe('HelpMenu', () => {
  const renderOpen = () => {
    render(
      <HelpMenu
        outlineButtonClass=""
        onOpenHelpDialog={vi.fn()}
        onOpenAboutDialog={vi.fn()}
        onOpenKeyboardShortcuts={vi.fn()}
        onOpenFeedback={vi.fn()}
      />,
    );
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
});

describe('MobileNavigation', () => {
  it('marks only the active item with aria-current="page"', () => {
    const { container } = render(
      <MobileNavigation
        locationPath="/"
        activeUmlType={UMLDiagramType.ClassDiagram}
        activeDiagramType="ClassDiagram"
        isDarkTheme={false}
        perspectives={undefined}
        onSwitchUml={vi.fn()}
        onSwitchDiagramType={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
});
