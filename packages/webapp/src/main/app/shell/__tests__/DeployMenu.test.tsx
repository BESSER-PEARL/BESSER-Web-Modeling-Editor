import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeployMenu } from '../menus/DeployMenu';

const renderOpen = (props: Partial<React.ComponentProps<typeof DeployMenu>> = {}) => {
  const onOpenDeployDialog = vi.fn();
  render(
    <DeployMenu
      outlineButtonClass=""
      isAuthenticated
      githubLoading={false}
      isDeploymentAvailable
      onGitHubLogin={vi.fn()}
      onOpenDeployDialog={onOpenDeployDialog}
      {...props}
    />,
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Deploy' }), { key: 'ArrowDown' });
  return { onOpenDeployDialog };
};

describe('DeployMenu', () => {
  it('disables publishing and says why when GitHub is not connected', () => {
    const { onOpenDeployDialog } = renderOpen({ isAuthenticated: false });

    expect(screen.getByRole('menuitem', { name: 'Connect GitHub to Deploy' })).not.toHaveAttribute('data-disabled');
    const publish = screen.getByRole('menuitem', { name: 'Publish to Render…' });
    expect(publish).toHaveAttribute('data-disabled');
    expect(publish).toHaveAccessibleDescription('Connect GitHub first');

    fireEvent.click(publish);
    expect(onOpenDeployDialog).not.toHaveBeenCalled();
  });

  it('keeps publishing enabled with no hint once GitHub is connected', () => {
    const { onOpenDeployDialog } = renderOpen();

    expect(screen.queryByRole('menuitem', { name: 'Connect GitHub to Deploy' })).toBeNull();
    const publish = screen.getByRole('menuitem', { name: 'Publish to Render…' });
    expect(publish).not.toHaveAttribute('data-disabled');
    expect(screen.queryByText('Connect GitHub first')).toBeNull();

    fireEvent.click(publish);
    expect(onOpenDeployDialog).toHaveBeenCalledTimes(1);
  });

  it('explains a disabled item when the current diagram cannot be deployed', () => {
    renderOpen({ isDeploymentAvailable: false });

    const publish = screen.getByRole('menuitem', { name: 'Publish to Render…' });
    expect(publish).toHaveAttribute('data-disabled');
    expect(publish).toHaveAccessibleDescription('Deploy is available for Web App and Agent diagrams.');
  });
});
