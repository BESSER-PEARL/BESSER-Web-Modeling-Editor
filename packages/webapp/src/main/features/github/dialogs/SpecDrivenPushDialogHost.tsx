/**
 * SpecDrivenPushDialogHost — the single, app-level mount of the "Push to GitHub"
 * dialog.
 *
 * Mirrors ``SpecDrivenKeyDialogHost``: it lives as a sibling of the assistant drawer
 * (in ``application.tsx``), NOT inside it, so opening/closing the push dialog
 * never tears the drawer down. It reads the active project from the store and
 * drives ``useSpecDrivenGithubPush`` — whose open state comes from Redux
 * (``specDriven.pushDialogRunId``) — then renders the presentational
 * ``PushToGitHubDialog`` with the resulting ``dialog`` bag.
 *
 * The finished-run card's button opens this by dispatching
 * ``openPushDialog(runId)`` from anywhere (drawer or widget).
 */

import React from 'react';
import { useProject } from '../../../app/hooks/useProject';
import { useSpecDrivenGithubPush } from '../hooks/useSpecDrivenGithubPush';
import { PushToGitHubDialog } from './PushToGitHubDialog';

export const SpecDrivenPushDialogHost: React.FC = () => {
  const { currentProject } = useProject();
  const { dialog } = useSpecDrivenGithubPush({ currentProject });
  return <PushToGitHubDialog {...dialog} />;
};
