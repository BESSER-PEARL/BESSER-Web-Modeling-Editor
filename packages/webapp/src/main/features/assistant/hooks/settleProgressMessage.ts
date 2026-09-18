/**
 * Settling a progress status line into its outcome.
 *
 * A progress message renders as a status bar with a live spinner and nothing
 * ever removes it, so an outcome that is APPENDED rather than substituted leaves
 * a row spinning forever next to a row saying the work finished (2026-09-16).
 *
 * A pure function in its own module so the behaviour can be tested without
 * mounting `useAssistantLogic` (WebSocket client, store and i18n).
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
