import { describe, expect, it } from 'vitest';
import { safeColor, sanitizeSvg } from '@besser/wme';

// A model is a file anyone with write access to a linked repository can edit.
describe('sanitizeSvg', () => {
  it('strips what would run', () => {
    // Found in review: this icon sent the session to another host when a class was drawn.
    const icon = '<svg><foreignObject><img src=x onerror="alert(1)"></foreignObject><script>alert(2)</script><rect onclick="alert(3)" width="1"/></svg>';

    const clean = sanitizeSvg(icon);

    expect(clean).not.toMatch(/onerror|onclick|script|foreignObject/i);
    expect(clean).toContain('<rect');
  });

  it('strips <style>, which would restyle the whole page', () => {
    expect(sanitizeSvg('<svg><style>* { overflow: visible; }</style><rect width="1"/></svg>')).not.toContain('style');
  });

  it('strips anything that fetches from elsewhere', () => {
    const clean = sanitizeSvg(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><rect fill="url(https://evil.test/a)"/><rect style="fill:url(//evil.test/b)"/><image href="https://evil.test/c"/><image xlink:href="https://evil.test/d"/></svg>',
    );

    expect(clean).not.toContain('evil.test');
  });

  it('keeps local references and embedded images', () => {
    const clean = sanitizeSvg('<svg><clipPath id="c"><rect/></clipPath><g clip-path="url(#c)"/><image href="data:image/png;base64,AAAA"/></svg>');

    expect(clean).toContain('url(#c)');
    expect(clean).toContain('data:image/png');
  });

  it('prefixes ids and every reference to them, so they cannot resolve to the canvas', () => {
    // Filmed 2026-11-05: the canvas's clip of the same class cut off a new attribute's row.
    const clean = sanitizeSvg('<svg><clipPath id="clip-a"><rect/></clipPath><g clip-path="url(#clip-a)"/><g clip-path="url(#clip-a)"/></svg>', 'p-');

    expect(clean).toContain('id="p-clip-a"');
    expect(clean.match(/url\(#p-clip-a\)/g)).toHaveLength(2);
    expect(clean).not.toContain('url(#clip-a)');
  });
});

describe('safeColor', () => {
  it.each(['#ff0000', '#FFF', 'red', 'rgb(1, 2, 3)', 'rgba(1,2,3,0.5)', 'hsl(193 45% 38%)', 'var(--apollon-primary, #fff)'])(
    'keeps %s',
    (color) => {
      expect(safeColor(color)).toBe(color);
    },
  );

  it.each(['red}html:not(&){background-image:url(https://evil.test/a)}', 'url(https://evil.test/a)', 'red;background:url(x)', 42])(
    'drops %s',
    (color) => {
      expect(safeColor(color)).toBeUndefined();
    },
  );

  it('leaves a missing colour missing', () => {
    expect(safeColor(undefined)).toBeUndefined();
  });
});
