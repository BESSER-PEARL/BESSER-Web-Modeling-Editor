/**
 * The study-mode notice is the participant's only in-app disclosure, so it
 * must say what is recorded, that it is opt-in and how to stop — in every
 * shipped language, without internal wording or the participant's code.
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import en from '../../../../../../../i18n/en/webapp.json';
import lb from '../../../../../../../i18n/lb/webapp.json';
import de from '../../../../../../../i18n/de/webapp.json';
import fr from '../../../../../../../i18n/fr/webapp.json';
import es from '../../../../../../../i18n/es/webapp.json';
import ca from '../../../../../../../i18n/ca/webapp.json';

import { PilotSessionNotice } from '../PilotSessionNotice';
import { sessionStoragePilotParticipant } from '../../../constants/constant';

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('PilotSessionNotice', () => {
  it('renders nothing outside study mode', () => {
    const { container } = render(<PilotSessionNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('discloses what is recorded, that it is opt-in, and how to stop', () => {
    window.sessionStorage.setItem(sessionStoragePilotParticipant, 'P3');
    render(<PilotSessionNotice />);
    const notice = screen.getByRole('note');
    const text = notice.textContent ?? '';
    expect(text).toMatch(/study mode/i);
    expect(text).toMatch(/prompts/i);
    expect(text).toMatch(/study link/i);
    expect(text).toMatch(/close this tab/i);
    expect(text).not.toContain('P3');
  });
});

describe('study-mode notice copy', () => {
  const locales: Record<string, { assistant?: { pilotNotice?: string } }> = {
    en,
    lb,
    de,
    fr,
    es,
    ca,
  };

  for (const [code, dict] of Object.entries(locales)) {
    it(`"${code}" ships its own neutral notice`, () => {
      const notice = dict.assistant?.pilotNotice;
      expect(notice, `assistant.pilotNotice missing in ${code}`).toBeTruthy();
      expect(notice).not.toMatch(/pilot/i);
      if (code !== 'en') expect(notice).not.toBe(en.assistant.pilotNotice);
    });
  }
});
