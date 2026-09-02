/**
 * AssistantByokDialog — thin assistant-side wrapper around the shared
 * {@link LlmKeyDialog}.
 *
 * The app now has ONE unified BYOK key (entered via the shared dialog from the
 * assistant popup, the assistant drawer, or the Settings page). This wrapper
 * keeps the assistant's existing call sites unchanged while delegating the UI +
 * storage to the shared dialog. On save it also flips the Spec-Driven
 * generator's "key present" flag so entering the key here immediately powers
 * BOTH features.
 *
 * The raw key stays in sessionStorage only and is pushed to the agent socket by
 * the shared dialog via `client.setUserApiKey`. It NEVER enters Redux.
 */

import React from 'react';
import { useDispatch } from 'react-redux';

import { LlmKeyDialog } from '../../../shared/components/byok/LlmKeyDialog';
import { setApiKeyPresent } from '../../spec-driven/state/specDrivenSlice';
import type { AssistantClient } from '../services';

export interface AssistantByokDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shared assistant client — used to push/clear the key on the agent side. */
  client: AssistantClient;
  /** Optional callback fired after the user saves a key. */
  onKeySaved?: () => void;
}

export const AssistantByokDialog: React.FC<AssistantByokDialogProps> = ({
  open,
  onOpenChange,
  client,
  onKeySaved,
}) => {
  const dispatch = useDispatch();
  return (
    <LlmKeyDialog
      open={open}
      onOpenChange={onOpenChange}
      client={client}
      onSaved={() => {
        // The unified key now exists — let the Spec-Driven generator know so it
        // won't prompt again for the same key.
        dispatch(setApiKeyPresent(true));
        onKeySaved?.();
      }}
      onRemoved={() => dispatch(setApiKeyPresent(false))}
    />
  );
};
