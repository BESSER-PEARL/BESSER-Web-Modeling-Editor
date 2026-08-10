import React, { Component } from 'react';
import en from '../../../../../i18n/en/editor.json';
import lb from '../../../../../i18n/lb/editor.json';
import de from '../../../../../i18n/de/editor.json';
import fr from '../../../../../i18n/fr/editor.json';
import es from '../../../../../i18n/es/editor.json';
import ca from '../../../../../i18n/ca/editor.json';
import { Locale } from '../../services/editor/editor-types';
import { I18nContext, I18nProvider as Provider } from './i18n-context';

const defaultLocale = Locale.en;

type Props = {
  locale: Locale;
  children?: React.ReactNode;
};

const dictionary: { [key in Locale]: object } = {
  [Locale.en]: en,
  [Locale.lb]: lb,
  [Locale.de]: de,
  [Locale.fr]: fr,
  [Locale.es]: es,
  [Locale.ca]: ca,
};

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
    try {
      let translations = dictionary[this.props.locale];
      let translation: string = key.split('.').reduce((result, current) => result[current], translations as any);
      if (!translation) {
        translations = dictionary[defaultLocale];
        translation = key.split('.').reduce((result, current) => result[current], translations as any);
      }
      return translation;
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(error);
      return '';
    }
  };
}
