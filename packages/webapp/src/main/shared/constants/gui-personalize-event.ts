/**
 * Window event sent by the top bar Personalize button while the GUI editor is
 * open. The GUI editor listens for it and starts the "create personalized
 * variant" flow for the selected page.
 */
export const GUI_PERSONALIZE_EVENT = 'besser:gui-personalize';

/**
 * The GUI editor lives outside React, so the top bar talks to it with window events:
 * - GUI_VARIANTS_STATE_EVENT: editor -> top bar, `{ options: {id, label}[], activeId: string | null }` for the
 *   selected page (Base is `activeId === null`).
 * - GUI_VARIANT_SELECT_EVENT: top bar -> editor, `{ variantId: string | null }`; switches the selected page.
 * - GUI_VARIANTS_REQUEST_EVENT: top bar -> editor, asks it to publish its state again (sent when the top bar mounts).
 */
export const GUI_VARIANTS_STATE_EVENT = 'besser:gui-variants-state';
export const GUI_VARIANT_SELECT_EVENT = 'besser:gui-variant-select';
export const GUI_VARIANTS_REQUEST_EVENT = 'besser:gui-variants-request';

export interface GuiVariantsState {
  options: Array<{ id: string; label: string }>;
  activeId: string | null;
}
