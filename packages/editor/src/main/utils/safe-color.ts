const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%/-]+\)|var\(--[\w-]+(,\s*#[0-9a-f]{3,8})?\))$/i;

/**
 * A model's colour, or undefined when it is not one. Colours reach the page's stylesheet through
 * styled-components, and a model is a file anyone with write access to a repository can edit.
 */
export function safeColor(color: unknown): string | undefined {
  if (color === undefined || color === null || color === '') return undefined;
  if (typeof color === 'string' && SAFE_COLOR.test(color.trim())) return color.trim();
  console.warn('Ignoring an invalid colour in the model');
  return undefined;
}
