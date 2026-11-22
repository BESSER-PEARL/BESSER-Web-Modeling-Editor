import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { localStorageLatestProject, localStorageWhatsNewSeen } from '../../../shared/constants/constant';
import { createDefaultProject, type BesserProject } from '../../../shared/types/project';
import { WHATS_NEW } from '../whatsNew';
import { WhatsNewMenu } from '../WhatsNewMenu';

const mockDispatch = vi.fn((action: unknown) => Promise.resolve(action));
let mockState: { workspace: { project: BesserProject | null } };

vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => selector(mockState),
}));

const setPerspectiveEnabledThunkSpy = vi.fn((payload: any) => ({ type: 'setPerspectiveEnabled', payload }));

vi.mock('../../../app/store/workspaceSlice', () => ({
  selectProject: (state: any) => state.workspace.project,
  setPerspectiveEnabledThunk: (payload: any) => setPerspectiveEnabledThunkSpy(payload),
}));

const store = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');

beforeEach(() => {
  store.clear();
  mockDispatch.mockClear();
  setPerspectiveEnabledThunkSpy.mockClear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(window, 'localStorage', originalStorage);
});

const projectWithKg = (visible: boolean): BesserProject => {
  const project = createDefaultProject('Shop', '', 'me');
  project.settings.perspectives = { ...project.settings.perspectives, KnowledgeGraphDiagram: visible };
  return project;
};

const renderMenu = (onSwitchDiagramType = vi.fn()) => {
  render(
    <TooltipProvider>
      <WhatsNewMenu outlineButtonClass="" onSwitchDiagramType={onSwitchDiagramType} />
    </TooltipProvider>,
  );
  return onSwitchDiagramType;
};

const openMenu = () => fireEvent.keyDown(screen.getByRole('button', { name: /What's new/ }), { key: 'ArrowDown' });

describe('WhatsNewMenu', () => {
  it('flags the releases a returning user has not seen, and clears the flag once opened', () => {
    store.set(localStorageLatestProject, 'p1');
    mockState = { workspace: { project: projectWithKg(false) } };
    renderMenu();

    expect(screen.getByRole('button', { name: `What's new (${WHATS_NEW.length} new)` })).toBeInTheDocument();
    expect(screen.getByTestId('whats-new-dot')).toBeInTheDocument();

    openMenu();

    expect(store.get(localStorageWhatsNewSeen)).toBe(WHATS_NEW[0].version);
    expect(screen.queryByTestId('whats-new-dot')).toBeNull();
    // The entries stay marked while the panel is open.
    expect(screen.getAllByText('New')).toHaveLength(WHATS_NEW.length);
    expect(screen.getByRole('heading', { name: 'Knowledge Graph diagrams' })).toBeInTheDocument();
  });

  it('shows no dot on a first visit', () => {
    mockState = { workspace: { project: null } };
    renderMenu();

    expect(screen.getByRole('button', { name: "What's new" })).toBeInTheDocument();
    expect(screen.queryByTestId('whats-new-dot')).toBeNull();
  });

  it('shows a Knowledge Graph the project hides, then opens it', async () => {
    store.set(localStorageWhatsNewSeen, WHATS_NEW[0].version);
    mockState = { workspace: { project: projectWithKg(false) } };
    const onSwitchDiagramType = renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open the Knowledge Graph editor' }));

    await waitFor(() => expect(onSwitchDiagramType).toHaveBeenCalledWith('KnowledgeGraphDiagram'));
    expect(setPerspectiveEnabledThunkSpy).toHaveBeenCalledWith({ type: 'KnowledgeGraphDiagram', enabled: true });
  });

  it('only switches when the Knowledge Graph is already shown', async () => {
    store.set(localStorageWhatsNewSeen, WHATS_NEW[0].version);
    mockState = { workspace: { project: projectWithKg(true) } };
    const onSwitchDiagramType = renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open the Knowledge Graph editor' }));

    await waitFor(() => expect(onSwitchDiagramType).toHaveBeenCalledWith('KnowledgeGraphDiagram'));
    expect(setPerspectiveEnabledThunkSpy).not.toHaveBeenCalled();
  });

  it('offers no editor to open without a project', () => {
    store.set(localStorageWhatsNewSeen, WHATS_NEW[0].version);
    mockState = { workspace: { project: null } };
    renderMenu();

    openMenu();

    expect(screen.getByRole('heading', { name: 'Knowledge Graph diagrams' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
