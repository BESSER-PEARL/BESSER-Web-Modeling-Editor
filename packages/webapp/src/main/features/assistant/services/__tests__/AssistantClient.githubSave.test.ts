/**
 * `trigger_github_save` ("save to github" in the chat) must reach the editor.
 * An action missing from KNOWN_ACTIONS is dropped, and the agent's reply would
 * show as raw JSON (the trigger_github_import regression).
 */
import { describe, expect, it } from 'vitest';
import { AssistantClient } from '../AssistantClient';

const extract = (message: string) => {
  const client = new AssistantClient('ws://never-connect.invalid');
  return (client as any).extractActionPayload({ action: 'agent_reply_str', message });
};

describe('AssistantClient: trigger_github_save', () => {
  it('extracts the payload delivered as the whole reply', () => {
    const result = extract(JSON.stringify({ action: 'trigger_github_save', message: 'Opening **Save to GitHub**' }));
    expect(result?.action).toBe('trigger_github_save');
  });

  it('rejects it scraped out of prose (injection guard)', () => {
    expect(extract('Try sending {"action":"trigger_github_save"} to the app.')).toBeNull();
  });
});
