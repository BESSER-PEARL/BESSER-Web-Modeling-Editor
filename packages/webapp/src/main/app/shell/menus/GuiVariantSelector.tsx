import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GUI_VARIANTS_REQUEST_EVENT,
  GUI_VARIANTS_STATE_EVENT,
  GUI_VARIANT_SELECT_EVENT,
  type GuiVariantsState,
} from '../../../shared/constants/gui-personalize-event';

/**
 * Variant dropdown of the GUI perspective, the counterpart of the agent model variant selector.
 * It lists Base + one variant per profile of the page selected in the GUI editor and switches that page.
 * The editor (GrapesJS) is outside React, so the state travels through window events.
 */
export const GuiVariantSelector: React.FC = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<GuiVariantsState | null>(null);

  useEffect(() => {
    const onState = (event: Event) => setState((event as CustomEvent<GuiVariantsState>).detail ?? null);
    window.addEventListener(GUI_VARIANTS_STATE_EVENT, onState);
    // The editor may have published its state before this component mounted.
    window.dispatchEvent(new CustomEvent(GUI_VARIANTS_REQUEST_EVENT));
    return () => window.removeEventListener(GUI_VARIANTS_STATE_EVENT, onState);
  }, []);

  if (!state) return null;
  const baseLabel = t('topbar.baseGuiPage');
  const activeLabel = state.options.find((o) => o.id === state.activeId)?.label ?? baseLabel;
  const widthPx = Math.min(Math.max(100, activeLabel.length * 7.5 + 48), 280);

  return (
    <div className="hidden min-w-0 shrink items-center gap-1.5 xl:flex">
      <span className="hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground 2xl:inline">
        {t('topbar.variant')}
      </span>
      <select
        className="h-9 min-w-[80px] shrink rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
        style={{ width: `${widthPx}px` }}
        value={state.activeId ?? ''}
        onChange={(event) =>
          window.dispatchEvent(new CustomEvent(GUI_VARIANT_SELECT_EVENT, { detail: { variantId: event.target.value || null } }))
        }
        aria-label={t('topbar.selectGuiVariant')}
        title={activeLabel}
      >
        <option value="">{baseLabel}</option>
        {state.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
