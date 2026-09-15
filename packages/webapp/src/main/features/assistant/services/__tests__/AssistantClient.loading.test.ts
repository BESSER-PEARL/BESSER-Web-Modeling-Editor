/**
 * Regression: the loading ("thinking…") indicator must survive the
 * intermediate `progress` frames the agent streams during a long
 * generation.
 *
 * Bug: `handleMessage` cleared typing on EVERY incoming frame. The agent
 * sends `progress` keep-alives (~2s, ~10s, ~30s into a ~45s class-diagram
 * generation), so the first one hid the loading indicator for the rest of
 * the run — the user reported "I didn't get a loading message" and a
 * seemingly idle socket. A `progress` frame must NOT clear typing; only a
 * terminal reply (injection / message / error) does.
 */
import { describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';

const evt = (obj: unknown): MessageEvent =>
  ({ data: JSON.stringify(obj) } as MessageEvent);

describe('AssistantClient — loading indicator survives progress frames', () => {
  it('keeps typing TRUE across progress frames and clears it on the terminal reply', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    const typing: boolean[] = [];
    client.onTyping((t) => typing.push(t));

    // The send path sets typing on; simulate that starting state.
    (client as unknown as { emitTyping(t: boolean): void }).emitTyping(true);
    expect(typing.at(-1)).toBe(true);

    const handle = (e: MessageEvent) =>
      (client as unknown as { handleMessage(e: MessageEvent): void }).handleMessage(e);

    // Progress keep-alives during the generation must NOT drop the loader.
    handle(evt({ action: 'progress', message: 'Analyzing request', step: 1, total: 5 }));
    handle(evt({ action: 'progress', message: 'Generating classes', step: 3, total: 5 }));
    expect(typing.at(-1)).toBe(true);

    // The terminal reply clears the loader.
    handle(
      evt({
        action: 'inject_complete_system',
        diagramType: 'ClassDiagram',
        systemSpec: {},
        message: 'Done',
      }),
    );
    expect(typing.at(-1)).toBe(false);

    // Clean up the re-armed response-timeout timer the progress path sets.
    (client as unknown as { clearResponseTimer(): void }).clearResponseTimer();
  });
});
