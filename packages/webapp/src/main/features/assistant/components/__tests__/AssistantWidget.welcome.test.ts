/**
 * The bubble is the in-editor modeling assistant: its welcome offers modeling,
 * not code generation, which the Spec-Driven drawer is for (BESSER-PEARL/BESSER#747).
 */
import { describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../i18n/en/webapp.json';

vi.mock('../../hooks/useAssistantLogic', () => ({ useAssistantLogic: () => ({}) }));

import { WELCOME_SUGGESTION_KEYS } from '../AssistantWidget';

const lookup = (key: string): string =>
  key.split('.').reduce<any>((node, part) => node?.[part], en) as string;

describe('AssistantWidget welcome', () => {
  it('offers modeling chips only', () => {
    expect(WELCOME_SUGGESTION_KEYS).toHaveLength(3);
    for (const key of WELCOME_SUGGESTION_KEYS) {
      const label = lookup(key);
      expect(label, key).toBeTruthy();
      expect(label.toLowerCase(), key).not.toMatch(/generat|code/);
    }
  });

  it('does not list code generation among what it does', () => {
    expect(en.assistant.welcome.intro.toLowerCase()).not.toMatch(/generat|code/);
    expect(en.assistant.welcome.intro).toContain('models');
  });
});
