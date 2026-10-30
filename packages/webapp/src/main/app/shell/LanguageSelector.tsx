import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '../../shared/i18n/languages';
import { HeaderTooltip } from './menus/HeaderTooltip';

interface LanguageSelectorProps {
  outlineButtonClass?: string;
}

function useActiveLanguage() {
  const { i18n } = useTranslation();
  const active = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? SUPPORTED_LANGUAGES[0];
  return { active, i18n };
}

/** Language choices as menu radio items; shared by the top-bar selector and the mobile "More" menu. */
export const LanguageRadioItems: React.FC = () => {
  const { active, i18n } = useActiveLanguage();
  return (
    <DropdownMenuRadioGroup
      value={active.code}
      onValueChange={(code) => {
        void i18n.changeLanguage(code);
      }}
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <DropdownMenuRadioItem key={language.code} value={language.code} className="gap-2">
          <span>{language.nativeName}</span>
          <span className="ml-auto text-xs uppercase text-muted-foreground">{language.code}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
};

/**
 * Top-bar control to switch the editor UI language. Persists the choice via the
 * i18next language detector (localStorage `besser_language`); the editor engine
 * picks up the change through `BesserEditorComponent`'s `languageChanged` listener.
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ outlineButtonClass = '' }) => {
  const { t } = useTranslation();
  const { active } = useActiveLanguage();
  const label = t('topbar.language');

  return (
    <DropdownMenu>
      <HeaderTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`gap-1.5 ${outlineButtonClass}`} aria-label={label}>
            <Languages className="size-4" aria-hidden="true" />
            <span className="hidden text-xs font-medium uppercase sm:inline">{active.code}</span>
          </Button>
        </DropdownMenuTrigger>
      </HeaderTooltip>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <LanguageRadioItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
