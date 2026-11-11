import { describe, expect, it } from 'vitest';

import en from '../../../../../../i18n/en/webapp.json';
import lb from '../../../../../../i18n/lb/webapp.json';
import de from '../../../../../../i18n/de/webapp.json';
import fr from '../../../../../../i18n/fr/webapp.json';
import es from '../../../../../../i18n/es/webapp.json';
import ca from '../../../../../../i18n/ca/webapp.json';

const locales: Record<string, unknown> = { en, lb, de, fr, es, ca };

const get = (tree: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);

describe('GitHub strings in every language', () => {
  it.each(Object.keys(locales))('%s: the "Save it on GitHub" hint names the repository it creates', (lang) => {
    // The project hub renders this key with <Trans>; it was missing in every locale.
    const text = get(locales[lang], 'project.hub.create.github.privateRepo');
    expect(typeof text).toBe('string');
    expect(text).toContain('<repo>{{repo}}</repo>');
  });

  it.each(Object.keys(locales))('%s: the AI-reading notice and the error messages carry no em dash', (lang) => {
    for (const key of [
      'github.aiReading.title',
      'github.aiReading.description',
      'project.hub.github.errors.sessionExpired',
      'project.hub.github.errors.repoNotFound',
    ]) {
      const text = get(locales[lang], key);
      expect(typeof text, `${lang} ${key}`).toBe('string');
      expect(text as string).not.toContain('—');
    }
    expect(get(locales[lang], 'github.aiReading.description')).toContain('{{repo}}');
  });

  it('says BESSER asks before code goes to an AI model, in the pickers and the Help guide', () => {
    expect(get(en, 'project.hub.github.description')).toContain('asks you before sending');
    expect(get(en, 'github.startFromRepo.description')).toContain('asks you before sending');
    const guide = get(en, 'dialogs.guide.github.anyRepo.body') as string;
    expect(guide).toContain('it asks you first');
    expect(guide).toContain('third-party provider');
  });
});
