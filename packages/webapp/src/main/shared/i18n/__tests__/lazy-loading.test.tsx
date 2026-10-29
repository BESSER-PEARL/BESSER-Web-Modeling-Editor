import { describe, it, expect, vi } from 'vitest';
import { Locale } from '@besser/wme';

import deWebapp from '../../../../../../i18n/de/webapp.json';
import frWebapp from '../../../../../../i18n/fr/webapp.json';
import enEditor from '../../../../../../i18n/en/editor.json';
import deEditor from '../../../../../../i18n/de/editor.json';
import { translate } from '../../../../../../library/lib/i18n';

import i18n from '../index';
import { LANGUAGE_STORAGE_KEY } from '../languages';

const SHELL_KEY = 'menu.file.importProject';

/** An editor label, looked up synchronously the way the editor's components do. */
const editorLabel = (locale: Locale) => translate('views.highlight', undefined, locale);

// Test order matters: the first test observes the startup state of the shared instance.
describe('webapp i18n lazy language loading', () => {
  it('bundles only English at startup', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('de', 'translation')).toBe(false);
    // An editor locale that is not loaded yet falls back to English, never to raw keys.
    expect(editorLabel(Locale.de)).toBe(enEditor.views.highlight);
  });

  it('loads the shell and editor labels before announcing a language switch', async () => {
    const seenOnChange: Array<[string, string]> = [];
    const onChange = () => seenOnChange.push([i18n.t(SHELL_KEY), editorLabel(Locale.de)]);
    i18n.on('languageChanged', onChange);
    try {
      await i18n.changeLanguage('de');
    } finally {
      i18n.off('languageChanged', onChange);
    }

    expect(seenOnChange).toEqual([[deWebapp.menu.file.importProject, deEditor.views.highlight]]);
  });

  it('starts in a stored non-English language with its strings already loaded', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    vi.resetModules();
    const fresh = await import('../index');

    await fresh.i18nReady;

    expect(fresh.default.language).toBe('fr');
    expect(fresh.default.t(SHELL_KEY)).toBe(frWebapp.menu.file.importProject);
  });
});
