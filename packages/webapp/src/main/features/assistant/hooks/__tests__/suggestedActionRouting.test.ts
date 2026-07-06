import { describe, it, expect } from 'vitest';
import { shouldOpenGuiTab } from '../suggestedActionRouting';

describe('shouldOpenGuiTab', () => {
  it('routes "Modify the GUI" to the GUI tab', () => {
    expect(shouldOpenGuiTab({ label: 'Modify the GUI', prompt: 'Modify the generated GUI' })).toBe(true);
  });

  it('routes "See GUI" / "View the GUI" / "Open GUI editor" to the GUI tab', () => {
    expect(shouldOpenGuiTab({ label: 'See GUI' })).toBe(true);
    expect(shouldOpenGuiTab({ label: 'View the GUI' })).toBe(true);
    expect(shouldOpenGuiTab({ label: 'Open the GUI editor' })).toBe(true);
  });

  it('relays "Generate web app" (never hijacks to the GUI tab)', () => {
    expect(shouldOpenGuiTab({ label: 'Generate web app', prompt: 'Generate the web app' })).toBe(false);
  });

  it('relays "Generate read frontend"', () => {
    expect(shouldOpenGuiTab({ label: 'Generate read frontend', prompt: 'Generate a read-only frontend' })).toBe(false);
  });

  it('keeps relaying a generate action even if its text mentions the GUI', () => {
    expect(shouldOpenGuiTab({ label: 'Generate app from the GUI' })).toBe(false);
  });

  it('honors an explicit action:"open-gui" hint', () => {
    expect(shouldOpenGuiTab({ label: 'Whatever', action: 'open-gui' })).toBe(true);
  });

  it('matches on the prompt when the label is generic', () => {
    expect(shouldOpenGuiTab({ label: 'Continue', prompt: 'Let me edit the GUI' })).toBe(true);
  });

  it('relays an unrelated chip', () => {
    expect(shouldOpenGuiTab({ label: 'Add a Payment class', prompt: 'Add a Payment class' })).toBe(false);
  });

  it('is safe on null/undefined/empty input', () => {
    expect(shouldOpenGuiTab(null)).toBe(false);
    expect(shouldOpenGuiTab(undefined)).toBe(false);
    expect(shouldOpenGuiTab({})).toBe(false);
  });
});
