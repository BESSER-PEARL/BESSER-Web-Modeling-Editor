import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UMLDiagramType } from '@besser/wme';

import { WorkspaceSidebar } from '../WorkspaceSidebar';
import { ALL_DIAGRAM_TYPES } from '../../../shared/types/project';
import type { SupportedDiagramType } from '../../../shared/types/project';

const props = (overrides: Partial<React.ComponentProps<typeof WorkspaceSidebar>> = {}) => ({
  isDarkTheme: false,
  isSidebarExpanded: true,
  sidebarBaseClass: '',
  sidebarTitleClass: '',
  sidebarDividerClass: '',
  sidebarToggleClass: '',
  sidebarToggleTextClass: '',
  locationPath: '/',
  activeUmlType: UMLDiagramType.ClassDiagram,
  activeDiagramType: 'ClassDiagram' as SupportedDiagramType,
  diagramCounts: Object.fromEntries(ALL_DIAGRAM_TYPES.map((t) => [t, 1])),
  perspectives: undefined,
  onSwitchUml: vi.fn(),
  onSwitchDiagramType: vi.fn(),
  onNavigate: vi.fn(),
  ...overrides,
});

const kgSettings = () => screen.queryByRole('button', { name: 'KG Settings' });

describe('Knowledge Graph entry of the sidebar', () => {
  it('lists the Knowledge Graph editor without its settings while another diagram is open', () => {
    render(<WorkspaceSidebar {...props()} />);

    expect(screen.getByRole('button', { name: 'KG' })).toBeInTheDocument();
    expect(kgSettings()).toBeNull();
  });

  it('opens the Knowledge Graph editor on click', () => {
    const onSwitchDiagramType = vi.fn();
    render(<WorkspaceSidebar {...props({ onSwitchDiagramType })} />);

    fireEvent.click(screen.getByRole('button', { name: 'KG' }));

    expect(onSwitchDiagramType).toHaveBeenCalledWith('KnowledgeGraphDiagram');
  });

  it('shows the settings link under it while the editor is open, and navigates there', () => {
    const onNavigate = vi.fn();
    render(<WorkspaceSidebar {...props({ activeDiagramType: 'KnowledgeGraphDiagram', onNavigate })} />);

    fireEvent.click(kgSettings()!);

    expect(onNavigate).toHaveBeenCalledWith('/kg-settings');
  });

  it('keeps the settings link, marked as the current page, while on the settings route', () => {
    render(<WorkspaceSidebar {...props({ activeDiagramType: 'KnowledgeGraphDiagram', locationPath: '/kg-settings' })} />);

    expect(kgSettings()).toHaveAttribute('aria-current', 'page');
    // The editor button itself is no longer the current page.
    expect(screen.getByRole('button', { name: 'KG' })).not.toHaveAttribute('aria-current');
  });

  it('marks the editor as the current page while it is open', () => {
    render(<WorkspaceSidebar {...props({ activeDiagramType: 'KnowledgeGraphDiagram' })} />);

    expect(screen.getByRole('button', { name: 'KG' })).toHaveAttribute('aria-current', 'page');
    expect(kgSettings()).not.toHaveAttribute('aria-current');
  });

  it('does not show the KG entry when the project hides it', () => {
    const perspectives = Object.fromEntries(ALL_DIAGRAM_TYPES.map((t) => [t, t !== 'KnowledgeGraphDiagram'])) as any;
    render(<WorkspaceSidebar {...props({ perspectives })} />);

    expect(screen.queryByRole('button', { name: 'KG' })).toBeNull();
  });
});

describe('Agent sub-items share the same component', () => {
  it('still offers Simulate Agent and navigates to its routes while the agent editor is open', () => {
    const onTestAgent = vi.fn();
    render(
      <WorkspaceSidebar
        {...props({ activeUmlType: UMLDiagramType.AgentDiagram, activeDiagramType: 'AgentDiagram', onTestAgent })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Simulate Agent' }));

    expect(onTestAgent).toHaveBeenCalledTimes(1);
  });
});
