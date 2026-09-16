/**
 * Settling a progress status line into its outcome.
 *
 * Progress messages render as a status bar with a live spinner and an
 * "in progress" badge, and nothing ever removes them from the visible
 * conversation. The auto-fix flow APPENDED its outcome instead of replacing
 * the status line, so the chat kept a row spinning forever next to a second
 * row saying the work had finished ("this never vanish in the chat",
 * 2026-09-16).
 *
 * Kept as a pure function in its own module so the behaviour is tested
 * directly rather than through a copy — mounting `useAssistantLogic` would
 * drag in the WebSocket client, the store and i18n.
 */

/** The subset of a chat message this reducer touches. */
export interface SettleableMessage {
  id: string;
  content: string;
  isProgress?: boolean;
  isError?: boolean;
}

/**
 * Replace the progress row `id` with `text`, clearing its spinner.
 *
 * When the row is no longer present — the conversation was cleared while the
 * repair was in flight — the outcome is appended instead, via `makeMessage`,
 * so the result is never silently dropped.
 */
export function settleProgressMessage<T extends SettleableMessage>(
  messages: T[],
  id: string | null,
  text: string,
  makeMessage: (text: string, isError: boolean) => T,
  isError = false,
): T[] {
  if (id && messages.some((m) => m.id === id)) {
    return messages.map((m) =>
      m.id === id
        ? { ...m, content: text, isProgress: false, isError: isError || undefined }
        : m,
    );
  }
  return [...messages, makeMessage(text, isError)];
}
