import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GenerateMenu } from '../menus/GenerateMenu';
import { FileMenu } from '../menus/FileMenu';
import { MoreMenu } from '../menus/MoreMenu';
import { TopBarUtilities } from '../menus/TopBarUtilities';
import { LanguageSelector } from '../LanguageSelector';

// The GitHub control has its own tests; here it only has to be mounted once.
vi.mock('../../../features/github/components/GitHubMenu', () => ({
  GitHubMenu: ({ isAuthenticated, username }: { isAuthenticated: boolean; username?: string }) => (
    <div data-testid="github-menu">{isAuthenticated ? `signed in as ${username}` : 'signed out'}</div>
  ),
}));

const withTooltips = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);
const openMenu = (name: string) => fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'ArrowDown' });

describe('GenerateMenu', () => {
  it('shows a spinner and aria-busy on the trigger while generating', () => {
    withTooltips(<GenerateMenu mode="class" isGenerating primaryGenerateClass="" onGenerate={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Generating…' });
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(trigger.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('has no busy state when idle and no redundant "Code Generation" heading', () => {
    withTooltips(<GenerateMenu mode="class" isGenerating={false} primaryGenerateClass="" onGenerate={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Generate' });
    expect(trigger).not.toHaveAttribute('aria-busy');
    openMenu('Generate');
    expect(screen.queryByText('Code Generation')).toBeNull();
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });
});

describe('FileMenu', () => {
  const renderOpen = (hasProject = true, onShareAsGist = vi.fn()) => {
    withTooltips(
      <FileMenu
        outlineButtonClass=""
        hasProject={hasProject}
        activeDiagramType="ClassDiagram"
        onOpenProjectHub={vi.fn()}
        onOpenTemplateDialog={vi.fn()}
        onExportProject={vi.fn()}
        onImportSingleDiagram={vi.fn()}
        onImportBpmnDiagram={vi.fn()}
        onOpenAssistantImportImage={vi.fn()}
        onOpenAssistantImportKg={vi.fn()}
        onImportOwl={vi.fn()}
        onOpenProjectPreview={vi.fn()}
        onShareAsGist={onShareAsGist}
      />,
    );
    openMenu('File');
  };

  it('has a single Import submenu and no repeated heading', () => {
    renderOpen();

    expect(screen.getAllByRole('menuitem', { name: /import/i })).toHaveLength(1);
    expect(screen.queryByText('Import Class Diagram from')).toBeNull();
    expect(screen.queryByText('Project Actions')).toBeNull();
  });

  it('shares the project as a secret gist from the File menu', () => {
    const onShareAsGist = vi.fn();
    renderOpen(true, onShareAsGist);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share as Secret Gist…' }));
    expect(onShareAsGist).toHaveBeenCalledTimes(1);
  });

  it('disables gist sharing without a project', () => {
    renderOpen(false);
    expect(screen.getByRole('menuitem', { name: 'Share as Secret Gist…' })).toHaveAttribute('data-disabled');
  });

  it('gives every top-level item an icon', () => {
    renderOpen();
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });
});

describe('LanguageSelector', () => {
  it('marks the current language as a checked radio item', () => {
    withTooltips(<LanguageSelector />);
    openMenu('Language');

    const radios = screen.getAllByRole('menuitemradio');
    expect(radios.length).toBeGreaterThan(1);
    const checked = radios.filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('English');
  });
});

describe('MoreMenu', () => {
  it('collects Deploy, Help, Language and Theme for narrow screens', () => {
    const onToggleTheme = vi.fn();
    withTooltips(
      <MoreMenu
        outlineButtonClass=""
        isDarkTheme={false}
        isAuthenticated={false}
        githubLoading={false}
        isDeploymentAvailable
        onGitHubLogin={vi.fn()}
        onGitHubLogout={vi.fn()}
        onOpenDeployDialog={vi.fn()}
        onOpenHelpDialog={vi.fn()}
        onOpenAboutDialog={vi.fn()}
        onOpenKeyboardShortcuts={vi.fn()}
        onOpenFeedback={vi.fn()}
        onToggleTheme={onToggleTheme}
      />,
    );
    openMenu('More');

    expect(screen.getByRole('menuitem', { name: 'Publish to Render…' })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('menuitem', { name: 'Keyboard Shortcuts ?' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Language' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to dark mode' }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
});

describe('TopBarUtilities', () => {
  it('names the quality check button with its title and state', () => {
    withTooltips(
      <TopBarUtilities
        showQualityCheck
        outlineButtonClass=""
        isDarkTheme={false}
        isAuthenticated={false}
        githubLoading={false}
        hasStarred={false}
        starLoading={false}
        qualityCheckState="valid"
        onQualityCheck={vi.fn()}
        onToggleTheme={vi.fn()}
        onGitHubLogin={vi.fn()}
        onGitHubLogout={vi.fn()}
        onToggleStar={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quality Check: Validated' })).toBeInTheDocument();
  });

  it('renders the single GitHub control with the sign-in state', () => {
    withTooltips(
      <TopBarUtilities
        showQualityCheck={false}
        outlineButtonClass=""
        isDarkTheme={false}
        isAuthenticated
        username="ana"
        githubLoading={false}
        hasStarred
        starLoading={false}
        onQualityCheck={vi.fn()}
        onToggleTheme={vi.fn()}
        onGitHubLogin={vi.fn()}
        onGitHubLogout={vi.fn()}
        onToggleStar={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('github-menu')).toHaveLength(1);
    expect(screen.getByTestId('github-menu')).toHaveTextContent('signed in as ana');
  });

  it('offers the syntactic and semantic checks in a menu when a semantic check is given', () => {
    const onQualityCheck = vi.fn();
    const onSemanticCheck = vi.fn();
    withTooltips(
      <TopBarUtilities
        showQualityCheck
        outlineButtonClass=""
        isDarkTheme={false}
        isAuthenticated={false}
        githubLoading={false}
        hasStarred={false}
        starLoading={false}
        onQualityCheck={onQualityCheck}
        onSemanticCheck={onSemanticCheck}
        onToggleTheme={vi.fn()}
        onGitHubLogin={vi.fn()}
        onGitHubLogout={vi.fn()}
        onToggleStar={vi.fn()}
      />,
    );

    openMenu('Quality Check');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Semantic check' }));
    openMenu('Quality Check');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Syntactic check' }));

    expect(onSemanticCheck).toHaveBeenCalledTimes(1);
    expect(onQualityCheck).toHaveBeenCalledTimes(1);
  });
});
