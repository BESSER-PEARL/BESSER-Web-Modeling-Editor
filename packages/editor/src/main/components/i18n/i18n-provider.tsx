import React, { Component } from 'react';
import en from '../../../../../i18n/en/editor.json';
import { Locale } from '../../services/editor/editor-types';
import { I18nContext, I18nProvider as Provider } from './i18n-context';

const defaultLocale = Locale.en;

type Props = {
  locale: Locale;
  children?: React.ReactNode;
};

/**
 * Walk a dotted key into a translation bundle.
 *
 * Returns `undefined` for every kind of miss — a missing segment, a segment
 * that resolves to an object instead of a leaf, or a segment looked up on a
 * non-object. Resolving must never throw: a key that exists in `en` but not
 * yet in a locale (a freshly added feature) has to fall through to the default
 * locale, not blow up the whole lookup and render an empty label.
 */
const resolve = (key: string, translations: object | undefined): string | undefined => {
  if (!translations) return undefined;
  let current: unknown = translations;
  for (const part of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
};

// English is bundled as the fallback; every other locale is its own chunk, added by `loadLocale`.
const dictionary: Partial<Record<Locale, object>> = { [Locale.en]: en };

const loaders: Record<Exclude<Locale, Locale.en>, () => Promise<{ default: object }>> = {
  [Locale.lb]: () => import('../../../../../i18n/lb/editor.json'),
  [Locale.de]: () => import('../../../../../i18n/de/editor.json'),
  [Locale.fr]: () => import('../../../../../i18n/fr/editor.json'),
  [Locale.es]: () => import('../../../../../i18n/es/editor.json'),
  [Locale.ca]: () => import('../../../../../i18n/ca/editor.json'),
};

/** Fetch a locale's labels. Until it resolves, an editor in that locale shows English. */
export async function loadLocale(locale: Locale): Promise<void> {
  if (dictionary[locale]) return;
  dictionary[locale] = (await loaders[locale as Exclude<Locale, Locale.en>]()).default;
}

export class I18nProvider extends Component<Props> {
  static defaultProps = {
    locale: defaultLocale,
  };

  render() {
    const value: I18nContext = {
      translate: this.translate,
    };
    return <Provider value={value}>{this.props.children}</Provider>;
  }

  private translate = (key: string): string => {
    const translation = resolve(key, dictionary[this.props.locale]);
    if (translation) return translation;
    return resolve(key, dictionary[defaultLocale]) ?? '';
  };
}
