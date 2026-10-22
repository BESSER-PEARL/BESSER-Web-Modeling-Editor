import { describe, expect, it } from 'vitest';

import { buildKgStylesheet, kgStylesheet } from '../stylesheet';

type Rule = { selector: string; style: Record<string, unknown> };
const rule = (sheet: Rule[], selector: string) => sheet.find((r) => r.selector === selector)!;

describe('buildKgStylesheet', () => {
  const light = buildKgStylesheet(false) as Rule[];
  const dark = buildKgStylesheet(true) as Rule[];

  it('keeps the exported light stylesheet as the default', () => {
    expect(kgStylesheet).toEqual(light);
  });

  it('has the same rules in both themes, only restyled', () => {
    expect(dark.map((r) => r.selector)).toEqual(light.map((r) => r.selector));
  });

  it('keeps node colours: they carry their own fill and contrasting text', () => {
    for (const nodeType of ['class', 'individual', 'property', 'literal', 'blank', 'nodeConstraint']) {
      const selector = `node[nodeType = "${nodeType}"]`;
      expect(rule(dark, selector).style['background-color']).toBe(rule(light, selector).style['background-color']);
      expect(rule(dark, selector).style.color).toBe(rule(light, selector).style.color);
    }
  });

  it('draws relation labels light-on-dark in the dark theme, with a label background that matches the canvas', () => {
    const lightEdge = rule(light, 'edge').style;
    const darkEdge = rule(dark, 'edge').style;

    expect(darkEdge.color).not.toBe(lightEdge.color);
    expect(darkEdge['text-background-color']).not.toBe(lightEdge['text-background-color']);
    expect(darkEdge['text-background-color']).not.toBe('#ffffff');
    expect(darkEdge['line-color']).not.toBe(lightEdge['line-color']);
  });

  it('shows the selection in a colour that stands out against the theme background', () => {
    // Black on a dark canvas is invisible.
    expect(rule(light, ':selected').style['border-color']).toBe('#000000');
    expect(rule(dark, ':selected').style['border-color']).toBe('#ffffff');
  });

  it('is a fresh object every time, so callers can mutate or reuse it safely', () => {
    expect(buildKgStylesheet(true)).not.toBe(buildKgStylesheet(true));
  });
});
