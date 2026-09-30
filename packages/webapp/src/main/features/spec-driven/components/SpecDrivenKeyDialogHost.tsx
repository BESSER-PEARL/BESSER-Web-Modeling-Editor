/**
 * SpecDrivenKeyDialogHost — the app-level, Redux-driven host that shows the
 * shared {@link LlmKeyDialog} for the Spec-Driven Agent.
 *
 * It replaces the former dedicated SpecDrivenByokDialog: the unified dialog
 * already covers everything that dialog did (provider + key entry, the
 * keyless Free tier with its server-advertised model choice, run budget),
 * so the feature keeps only this thin adapter between the spec-driven
 * Redux state machine and the shared dialog.
 *
 * State machine (unchanged from the old dialog):
 *   - `openByokDialog(payload)` stashes a pending run and opens the dialog;
 *     `openByokDialog(null)` opens it in settings mode (chat's "use your
 *     own API key" link) without discarding a still-pending run.
 *   - Completing the dialog (saving a key, or confirming the Free tier)
 *     approves the pending trigger; the resume effect in
 *     `useSpecDrivenTrigger` consumes it and starts the run.
 *   - Cancelling clears the pending trigger and — when no key is stored —
 *     fires `wme:specdriven-key-cancelled` so the chat explains why the
 *     run did not start.
 */

import React, { useEffect, useRef } from 'react';

import {
  LlmKeyDialog,
  type LlmKeySavedDetail,
} from '../../../shared/components/byok/LlmKeyDialog';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import type { RootState } from '../../../app/store/store';
import {
  approvePendingTrigger,
  clearPendingTrigger,
  closeByokDialog,
  setApiKeyPresent,
  setProvider,
} from '../state/specDrivenSlice';
import type { SpecDrivenProvider } from '../types';

const RUN_MODE_DESCRIPTION =
  'This run needs a model to power it — the included free tier where ' +
  'offered, or your own API key. Your key stays in this browser tab only ' +
  'and is never stored on our servers.';

export const SpecDrivenKeyDialogHost: React.FC = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s: RootState) => s.specDriven.byokDialogOpen);
  const pendingTrigger = useAppSelector((s: RootState) => s.specDriven.pendingTrigger);
  const apiKeyPresent = useAppSelector((s: RootState) => s.specDriven.apiKeyInStore);

  // True between a successful save and the dialog's own onOpenChange(false)
  // that immediately follows it. Without this, the close event would run the
  // cancel path and clear the just-approved pending trigger before the
  // trigger hook's resume effect can consume it (the race the old dialog
  // guarded with startingRunRef).
  const completedRef = useRef(false);

  useEffect(() => {
    if (open) completedRef.current = false;
  }, [open]);

  const handleSaved = (detail: LlmKeySavedDetail) => {
    completedRef.current = true;
    // A free-tier save stores no key — only real BYOK saves flip the flag.
    if (detail.provider !== 'free') {
      dispatch(setApiKeyPresent(true));
    }
    dispatch(setProvider(detail.provider as SpecDrivenProvider));
    if (pendingTrigger) {
      // Approving closes the dialog and re-stamps the trigger; the resume
      // effect in useSpecDrivenTrigger consumes it and starts the run.
      dispatch(approvePendingTrigger({ ...pendingTrigger, planApproved: true }));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (next) return; // opening is Redux-driven (openByokDialog), never local
    if (completedRef.current) {
      // The close that follows a save — not a cancel. Just mirror the
      // closed state; the pending trigger (if any) is already approved.
      completedRef.current = false;
      dispatch(closeByokDialog());
      return;
    }
    // Genuine cancel (Cancel button, Escape, click outside). A pending run
    // cannot start without authorisation — tell the chat why.
    if (pendingTrigger && !apiKeyPresent) {
      window.dispatchEvent(new CustomEvent('wme:specdriven-key-cancelled'));
    }
    dispatch(clearPendingTrigger());
    dispatch(closeByokDialog());
  };

  return (
    <LlmKeyDialog
      open={open}
      onOpenChange={handleOpenChange}
      onSaved={handleSaved}
      onRemoved={() => dispatch(setApiKeyPresent(false))}
      title={pendingTrigger ? 'Spec-Driven Agent — Run' : undefined}
      description={pendingTrigger ? RUN_MODE_DESCRIPTION : undefined}
      saveLabel={pendingTrigger ? 'Save & run' : undefined}
      // Settings mode is reached from the chat's "use your own API key"
      // link — open on the key-entry flow (Free stays in the dropdown).
      preferKeyEntry={!pendingTrigger}
    />
  );
};
