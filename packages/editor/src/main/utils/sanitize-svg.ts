import DOMPurify from 'dompurify';

const REMOTE_URL = /url\(\s*['"]?(?!#)/i;
const LOCAL_ID_URL = /url\(\s*(['"]?)#/gi;
const SAFE_HREF = /^(#|data:image\/)/i;

/**
 * SVG safe to inline in the page, for markup that comes from a model and so from a file anyone with write
 * access to a repository can edit: no scripts, no <style> (it would restyle the whole page) and nothing
 * that fetches from elsewhere. `idPrefix` keeps its ids from colliding with the canvas's, since
 * `url(#id)` resolves to the first match in the document.
 */
export function sanitizeSvg(svg: string, idPrefix = ''): string {
  const fragment = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['style'],
    RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll('*').forEach((element) => {
    for (const { name, value } of Array.from(element.attributes)) {
      const isHref = name === 'href' || name === 'xlink:href';
      if ((isHref && !SAFE_HREF.test(value)) || REMOTE_URL.test(value)) {
        element.removeAttribute(name);
      } else if (idPrefix && name === 'id') {
        element.setAttribute(name, `${idPrefix}${value}`);
      } else if (idPrefix && isHref && value.startsWith('#')) {
        element.setAttribute(name, `#${idPrefix}${value.slice(1)}`);
      } else if (idPrefix && LOCAL_ID_URL.test(value)) {
        element.setAttribute(name, value.replace(LOCAL_ID_URL, `url($1#${idPrefix}`));
      }
      LOCAL_ID_URL.lastIndex = 0;
    }
  });
  const holder = document.createElement('div');
  holder.appendChild(fragment);
  return holder.innerHTML;
}
