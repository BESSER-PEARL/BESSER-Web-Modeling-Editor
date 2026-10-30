const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"'

/**
 * Turn a stored icon (inline SVG markup, a data URL or an http(s) URL) into
 * an `<image href>` value. Icons come from imported models, so they are never
 * inserted as markup: an SVG loaded as an image cannot run scripts.
 */
export function iconImageHref(icon: string): string {
  const trimmed = icon.trim()
  if (/^(data:image\/|https?:\/\/)/i.test(trimmed)) return trimmed
  let markup = /^<svg[\s>]/i.test(trimmed)
    ? trimmed
    : `<svg ${SVG_NS} viewBox="0 0 24 24">${trimmed}</svg>`
  if (!/^<svg[^>]*\sxmlns=/i.test(markup)) {
    markup = markup.replace(/^<svg/i, `<svg ${SVG_NS}`)
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

/** Monochrome icons draw in `currentColor`, which an image cannot inherit. */
export const iconUsesCurrentColor = (icon: string) => /currentColor/i.test(icon)
