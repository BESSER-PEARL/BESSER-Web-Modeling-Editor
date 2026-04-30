import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import { WorkspaceSidebar } from '../WorkspaceSidebar';
import { createDefaultProject } from '../../../shared/types/project';
import type { BesserProject, SupportedDiagramType } from '../../../shared/types/project';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a minimal set of WorkspaceSidebar props with sensible defaults. */
const defaultProps = (overrides: Partial<React.ComponentProps<typeof WorkspaceSidebar>> = {}) => ({
  isDarkTheme: false,
  isSidebarExpanded: true,
  sidebarBaseClass: 'sidebar',
  sidebarTitleClass: 'title',
  sidebarDividerClass: 'divider',
  sidebarToggleClass: 'toggle',
  sidebarToggleTextClass: 'toggle-text',
  locationPath: '/',
  activeUmlType: UMLDiagramType.ClassDiagram,
  activeDiagramType: 'ClassDiagram' as SupportedDiagramType,
  project: createDefaultProject('Test', '', 'owner'),
  onSwitchUml: vi.fn(),
  onSwitchDiagramType: vi.fn(),
  onNavigate: vi.fn(),
  onToggleExpanded: vi.fn(),
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('WorkspaceSidebar', () => {
  // There are 5 UML items (Class, Object, State, Agent, User) + 2 non-UML (GUI, Quantum) + 1 Settings route = 8 nav buttons
  // Plus the collapse/expand toggle button at the bottom.

  it('renders navigation buttons for all diagram types and settings', () => {
    render(<WorkspaceSidebar {...defaultProps()} />);

    // UML items
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Object')).toBeInTheDocument();
    expect(screen.getByText('State')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();

    // Non-UML items
    expect(screen.getByText('GUI')).toBeInTheDocument();
    expect(screen.getByText('Quantum')).toBeInTheDocument();

    // Route items
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows the "Editors" title when sidebar is expanded', () => {
    render(<WorkspaceSidebar {...defaultProps({ isSidebarExpanded: true })} />);
    expect(screen.getByText('Editors')).toBeInTheDocument();
  });

  it('hides the "Editors" title when sidebar is collapsed', () => {
    render(<WorkspaceSidebar {...defaultProps({ isSidebarExpanded: false })} />);
    expect(screen.queryByText('Editors')).not.toBeInTheDocument();
  });

  it('hides labels when sidebar is collapsed', () => {
    render(<WorkspaceSidebar {...defaultProps({ isSidebarExpanded: false })} />);

    // Labels should not be visible when collapsed
    expect(screen.queryByText('Class')).not.toBeInTheDocument();
    expect(screen.queryByText('Object')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows expanded labels when sidebar is expanded', () => {
    render(<WorkspaceSidebar {...defaultProps({ isSidebarExpanded: true })} />);

    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Object')).toBeInTheDocument();
    expect(screen.getByText('State')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('GUI')).toBeInTheDocument();
    expect(screen.getByText('Quantum')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders Class diagram button with accessible label', () => {
    render(<WorkspaceSidebar {...defaultProps()} />);

    expect(screen.getByRole('button', { name: 'Class' })).toBeInTheDocument();
  });

  it('highlights the active UML diagram button', () => {
    const props = defaultProps({
      locationPath: '/',
      activeUmlType: UMLDiagramType.ClassDiagram,
      activeDiagramType: 'ClassDiagram',
    });
    const { container } = render(<WorkspaceSidebar {...props} />);

    // The active button should have the active styling class (brand-related)
    const classButton = screen.getByText('Class').closest('button')!;
    expect(classButton.className).toContain('bg-brand');
  });

  it('highlights the active non-UML diagram button', () => {
    const props = defaultProps({
      locationPath: '/',
      activeDiagramType: 'GUINoCodeDiagram',
    });
    render(<WorkspaceSidebar {...props} />);

    const guiButton = screen.getByText('GUI').closest('button')!;
    expect(guiButton.className).toContain('bg-brand');
  });

  it('does not highlight non-active diagram buttons', () => {
    const props = defaultProps({
      locationPath: '/',
      activeUmlType: UMLDiagramType.ClassDiagram,
      activeDiagramType: 'ClassDiagram',
    });
    render(<WorkspaceSidebar {...props} />);

    const objectButton = screen.getByText('Object').closest('button')!;
    expect(objectButton.className).not.toContain('bg-brand');
  });

  it('calls onSwitchUml when clicking a UML diagram button', () => {
    const onSwitchUml = vi.fn();
    render(<WorkspaceSidebar {...defaultProps({ onSwitchUml })} />);

    fireEvent.click(screen.getByText('Object').closest('button')!);
    expect(onSwitchUml).toHaveBeenCalledWith(UMLDiagramType.ObjectDiagram);
  });

  it('calls onSwitchDiagramType when clicking a non-UML diagram button', () => {
    const onSwitchDiagramType = vi.fn();
    render(<WorkspaceSidebar {...defaultProps({ onSwitchDiagramType })} />);

    fireEvent.click(screen.getByText('GUI').closest('button')!);
    expect(onSwitchDiagramType).toHaveBeenCalledWith('GUINoCodeDiagram');
  });

  it('calls onNavigate when clicking Settings', () => {
    const onNavigate = vi.fn();
    render(<WorkspaceSidebar {...defaultProps({ onNavigate })} />);

    fireEvent.click(screen.getByText('Settings').closest('button')!);
    expect(onNavigate).toHaveBeenCalledWith('/project-settings');
  });

  it('calls onToggleExpanded when clicking the collapse/expand button', () => {
    const onToggleExpanded = vi.fn();
    render(<WorkspaceSidebar {...defaultProps({ onToggleExpanded })} />);

    const toggleButton = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(toggleButton);
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it('has correct aria-label on toggle button based on expanded state', () => {
    const { rerender } = render(
      <WorkspaceSidebar {...defaultProps({ isSidebarExpanded: true })} />,
    );
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();

    rerender(<WorkspaceSidebar {...defaultProps({ isSidebarExpanded: false })} />);
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
  });

  it('shows diagram count in label when project has multiple diagrams of a type', () => {
    const project = createDefaultProject('Test', '', 'owner');
    // Add a second ClassDiagram
    project.diagrams.ClassDiagram.push({
      id: 'second-class',
      title: 'Class Diagram 2',
      lastUpdate: new Date().toISOString(),
      model: {
        version: '3.0.0' as const,
        type: UMLDiagramType.ClassDiagram,
        size: { width: 1400, height: 740 },
        elements: {},
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      },
    });

    render(<WorkspaceSidebar {...defaultProps({ project })} />);

    // Should show "Class (2)" since there are 2 ClassDiagrams
    expect(screen.getByText('Class (2)')).toBeInTheDocument();
  });

  it('renders without project (null)', () => {
    render(<WorkspaceSidebar {...defaultProps({ project: null })} />);

    // Should still render all the navigation items
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('hides perspective entries when settings.perspectives flips them off', () => {
    const project = createDefaultProject('Test', '', 'owner');
    project.settings.perspectives.AgentDiagram = false;
    project.settings.perspectives.QuantumCircuitDiagram = false;

    render(<WorkspaceSidebar {...defaultProps({ project })} />);

    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Quantum')).not.toBeInTheDocument();
    expect(screen.getByText('Class')).toBeInTheDocument();
  });
});
