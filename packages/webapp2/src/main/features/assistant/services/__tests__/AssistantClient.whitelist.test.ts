/**
 * Whitelist regression test for AssistantClient.
 *
 * The `KNOWN_ACTIONS` Set in AssistantClient.ts is a runtime whitelist
 * — any action whose name is not in the set is silently dropped by
 * `isActionPayload()`. When the modeling agent emits a new action name
 * (e.g. `trigger_smart_generator`) the whitelist MUST be updated or
 * the new action never reaches `handleAction`.
 *
 * This test is explicitly pinned to `trigger_smart_generator` so if
 * someone accidentally removes it from KNOWN_ACTIONS, the test fails
 * loudly and they can't ship the regression.
 */

import { describe, expect, it } from 'vitest';
import { AssistantClient } from '../AssistantClient';

describe('AssistantClient whitelist — trigger_smart_generator regression', () => {
  it('can be constructed with a bogus URL (sanity)', () => {
    const client = new AssistantClient('ws://never-connect.invalid');
    expect(client).toBeDefined();
  });

  it('trigger_smart_generator is present in the source whitelist', async () => {
    // Read the AssistantClient source at test-time and verify the
    // action name appears in the KNOWN_ACTIONS set definition. This
    // literal regex check catches a find-and-replace-gone-wrong that
    // would otherwise silently drop the action.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'AssistantClient.ts',
    );
    const source = fs.readFileSync(sourcePath, 'utf-8');
    expect(source).toMatch(
      /KNOWN_ACTIONS\s*=\s*new Set\(\[[\s\S]*?'trigger_smart_generator'[\s\S]*?\]\)/,
    );
  });

  it('trigger_smart_generator is present in the AssistantActionName union', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'assistant-types.ts',
    );
    const source = fs.readFileSync(sourcePath, 'utf-8');
    expect(source).toMatch(
      /AssistantActionName[\s\S]*?'trigger_smart_generator'/,
    );
  });
});
