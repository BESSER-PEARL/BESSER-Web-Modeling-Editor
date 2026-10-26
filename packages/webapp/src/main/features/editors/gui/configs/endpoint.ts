import i18n from '@/main/shared/i18n';

// The form BESSER's DataBinding.endpoint accepts (besser/BUML/metamodel/gui/binding.py):
// a backend path ("/stats/sales?year=2025", not "//host/...") or an http(s) URL with a
// host, without whitespace, control or invisible format characters. A value it refuses
// is dropped (with a warning) when the GUI model is imported.
const ENDPOINT_RE =
  /^(\/(?!\/)|https?:\/\/[^/\s?#]+)[^\s\x00-\x1f\x7f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]*$/i;

/** The endpoint as BESSER reads it: trimmed, with the leading "/" a path typed without one gets. */
export const normalizeEndpoint = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.startsWith('/') || /^https?:\/\//i.test(text)) return text;
  return `/${text}`;
};

/** Whether ``value`` is an endpoint BESSER keeps; an empty value (no endpoint) counts as valid. */
export const isValidEndpoint = (value: unknown): boolean => {
  const text = normalizeEndpoint(value);
  return !text || ENDPOINT_RE.test(text);
};

/** Mark an endpoint input as invalid (red border, the reason as its tooltip), or clear the mark. */
export const markEndpointInput = (input: HTMLInputElement | null | undefined, value: unknown): void => {
  if (!input) return;
  const valid = isValidEndpoint(value);
  input.setAttribute('aria-invalid', valid ? 'false' : 'true');
  input.title = valid ? '' : i18n.t('editors.gui.traits.dataEndpointInvalid');
  input.style.borderColor = valid ? '' : '#e74c3c';
};

/** Mark the ``data-endpoint`` trait input of a GrapesJS component after its value changed. */
export const markEndpointTrait = (component: any, value: unknown): void => {
  const trait = component?.getTrait?.('data-endpoint');
  const view = trait?.view;
  const input = (view?.getInputEl?.() ?? view?.el?.querySelector?.('input')) as HTMLInputElement | null;
  markEndpointInput(input, value);
};
