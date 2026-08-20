import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '../../shared/i18n/languages';

interface LanguageSelectorProps {
  outlineButtonClass?: string;
}

/**
 * Top-bar control to switch the editor UI language. Persists the choice via the
 * i18next language detector (localStorage `besser_language`); the editor engine
 * picks up the change through `ApollonEditorComponent`'s `languageChanged` listener.
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ outlineButtonClass = '' }) => {
  const { t, i18n } = useTranslation();
  const active = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`gap-1.5 ${outlineButtonClass}`}
          title={t('topbar.language')}
          aria-label={t('topbar.language')}
        >
          <Languages className="size-4" />
          <span className="hidden text-xs font-medium uppercase sm:inline">{active.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{t('topbar.language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onSelect={() => {
              void i18n.changeLanguage(language.code);
            }}
            className="gap-2"
          >
            <Check className={`size-4 ${language.code === active.code ? 'opacity-100' : 'opacity-0'}`} />
            <span>{language.nativeName}</span>
            <span className="ml-auto text-xs uppercase text-muted-foreground">{language.code}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
