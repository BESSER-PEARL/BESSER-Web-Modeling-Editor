import { describe, expect, it } from 'vitest';
import grapesjs from 'grapesjs';
import type { UMLModel } from '@besser/wme';
import { aggregateGuiContent, aggregateGuiPresentation, applyGuiPresentation, guiProfileOptions } from '../gui-personalization';
import { buildVersionGuiModel, type PageSnapshot } from '../buildWebAppVersions';

const profile = (spec: object = {}): UMLModel => ({
  type: 'UserDiagram',
  elements: {
    user: { id: 'user', type: 'UserModelName', className: 'User', attributes: ['name'], personalization: spec },
    name: { id: 'name', type: 'UserModelAttribute', name: 'name = Alice', owner: 'user' },
  },
  relationships: {},
}) as unknown as UMLModel;

const page = (): PageSnapshot => ({
  components: [{
    type: 'default', tagName: 'div', attributes: { id: 'container' }, style: { padding: '10px' },
    components: [
      { type: 'text', tagName: 'h1', content: 'Hello', attributes: { id: 'title' }, style: { 'font-size': '12px' } },
      { type: 'input', tagName: 'input', attributes: { id: 'field', placeholder: 'Name' }, 'data-binding': 'user.name' },
      { type: 'image', attributes: { src: '/photo.png' }, style: { width: '200px' } },
    ],
  }],
  css: [{ selectors: ['#title'], style: { color: 'blue', 'font-size': '12px !important' }, pageId: 'home' }],
});

describe('GUI personalization rules', () => {
  it('recognizes summaries independently of content adaptation and agent rules', () => {
    const model = profile({ gui: { content: { summarizeLongContent: true } } });
    expect(aggregateGuiContent(model)).toEqual({ summarizeLongContent: true });
    expect(aggregateGuiPresentation(model)).toEqual({});
  });

  it('aggregates GUI content from profile attributes independently of agent content', () => {
    const model = profile({ content: { adaptContentToUserProfile: true } });
    expect(aggregateGuiContent(model)).toEqual({});
    (model.elements.name as any).personalization = { gui: { content: { adaptContentToUserProfile: true } } };
    expect(aggregateGuiContent(model)).toEqual({ adaptContentToUserProfile: true });
    expect(aggregateGuiPresentation(model)).toEqual({});
  });

  it('keeps all font-size groups when restoring a mixed-size snapshot in GrapesJS', () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      editor.Components.addType('table', { model: { defaults: { tagName: 'div', style: { width: '100%' } } } });
      editor.setComponents([
        { type: 'text', tagName: 'h1', attributes: { id: 'heading' }, style: { 'font-size': '36px' }, content: 'Heading' },
        { type: 'text', tagName: 'p', attributes: { id: 'paragraph' }, style: { 'font-size': '12px' }, content: 'Paragraph' },
        { type: 'table', attributes: { id: 'table' } },
      ]);
      const baseline = JSON.parse(JSON.stringify({ components: editor.Components.getWrapper()!.components().toJSON(), css: editor.Css.getAll().toJSON() }));
      const result = applyGuiPresentation(baseline, { size: 24 }, 'home');
      editor.Css.getAll().reset();
      editor.Components.getWrapper()!.components().reset(result.components);
      result.css.forEach((rule) => editor.Css.getAll().add(rule));
      const exportedCss = editor.Css.getAll().map((rule: { toCSS: () => string }) => rule.toCSS()).join('\n');
      expect(exportedCss).toContain('24px !important');
      expect(exportedCss).toContain('#table td');
      expect(editor.Components.getWrapper()!.components().at(1).getStyle()['font-size']).toBe('24px !important');
    } finally {
      editor.destroy();
    }
  });

  it('grows small text while preserving larger inline and stylesheet font sizes', () => {
    const baseline: PageSnapshot = {
      components: [
        { type: 'text', tagName: 'h1', attributes: { id: 'large' }, content: 'Large', style: { 'font-size': '36px' } },
        { type: 'text', tagName: 'p', attributes: { id: 'small' }, content: 'Small', style: { 'font-size': '12px' } },
        { type: 'text', tagName: 'p', attributes: { id: 'css-large' }, classes: ['large-text'], content: 'Styled' },
      ],
      css: [{ selectors: ['.large-text'], style: { 'font-size': '2rem' } }],
    };
    const result = applyGuiPresentation(baseline, { size: 24 }, 'home');
    expect(result.components[0].style['font-size']).toBe('36px');
    expect(result.components[1].style['font-size']).toBe('24px !important');
    expect(result.components[2].style['font-size']).toBe('32px !important');
    expect(result.css.find((rule) => rule.selectorsAdd === '#large')?.style['font-size']).toBe('36px !important');
    expect(baseline.components[1].style['font-size']).toBe('12px');
  });

  it('preserves measured inherited sizes when a parent grows, including relative sizes', () => {
    const baseline: PageSnapshot = {
      components: [{ type: 'default', tagName: 'div', attributes: { id: 'parent' }, style: { 'font-size': '16px' }, components: [
        { type: 'text', tagName: 'p', attributes: { id: 'relative' }, style: { 'font-size': '2em' }, content: 'Relative' },
        { type: 'text', tagName: 'p', attributes: { id: 'inherited' }, content: 'Inherited' },
      ] }], css: [], fontSizes: { '#parent': 16, '#relative': 32, '#inherited': 40 },
    };
    const result = applyGuiPresentation(baseline, { size: 24 }, 'home');
    expect(result.components[0].style['font-size']).toBe('24px !important');
    expect(result.components[0].components[0].style['font-size']).toBe('32px !important');
    expect(result.components[0].components[1].style['font-size']).toBe('40px !important');
  });

  it('retains the defined font size when mounting a snapshot in GrapesJS with existing ID rules', () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      const result = applyGuiPresentation({ components: [page().components[0].components[0]], css: page().css }, { size: 24 }, 'home');
      editor.Components.getWrapper()!.components().reset(result.components);
      result.css.forEach((rule) => editor.Css.getAll().add(rule));
      const heading = editor.Components.getWrapper()!.components().at(0);
      expect(heading.getStyle()['font-size']).toBe('24px !important');
    } finally {
      editor.destroy();
    }
  });

  it('extracts only GUI rules, including connected-box and attribute settings', () => {
    const model = profile({ presentation: { size: 99 }, gui: { presentation: { size: 20, color: '#000000' } } }) as any;
    model.elements.disability = {
      id: 'disability', type: 'UserModelName', className: 'Disability', attributes: ['severity'],
      personalization: { gui: { presentation: { size: 24 } } },
    };
    model.elements.severity = {
      id: 'severity', type: 'UserModelAttribute', name: 'severity = high',
      personalization: { gui: { presentation: { lineSpacing: 1.8 } } },
    };
    model.relationships.link = { source: { element: 'user' }, target: { element: 'disability' } };
    expect(aggregateGuiPresentation(model)).toEqual({ size: 24, color: '#000000', lineSpacing: 1.8 });
  });

  it('splits users on one canvas without mixing their rules and keeps single-tab IDs compatible', () => {
    const model = profile({ gui: { presentation: { size: 24 } } }) as any;
    model.elements.bob = { id: 'bob', type: 'UserModelName', className: 'User', attributes: ['bobName'], personalization: { gui: { presentation: { size: 16 } } } };
    model.elements.bobName = { id: 'bobName', type: 'UserModelAttribute', name: 'name = Bob', owner: 'bob' };
    const profiles = guiProfileOptions([{ id: 'tab', title: 'Users', model }]);
    expect(profiles.map((p) => p.id)).toEqual(['tab::user', 'tab::bob']);
    expect(profiles.map((p) => aggregateGuiPresentation(p.model).size)).toEqual([24, 16]);
    expect(guiProfileOptions([{ id: 'old-tab', title: 'Users', model: profile() }])[0].id).toBe('old-tab');
  });

  it('applies all six text rules without changing structure, content, IDs, or bindings', () => {
    const baseline = page();
    const result = applyGuiPresentation(baseline, {
      size: 24, font: 'serif', lineSpacing: 1.8, alignment: 'left', color: '#ff0000', contrast: 'high',
    }, 'home');
    const heading = result.components[0].components[0];
    expect(heading.style).toMatchObject({
      'font-size': '24px !important', 'font-family': 'Georgia, "Times New Roman", serif !important',
    });
    expect(result.components[0].style).toMatchObject({ padding: '10px', 'line-height': '1.8 !important', 'text-align': 'left !important', color: '#ff0000 !important' });
    expect(heading.content).toBe('Hello');
    expect(heading.attributes.id).toBe('title');
    expect(result.components[0].components[1]['data-binding']).toBe('user.name');
    expect(result.components[0].components[2]).toEqual(baseline.components[0].components[2]);
    expect(baseline).toEqual(page());
    expect(result.css[result.css.length - 1].pageId).toBe('home');
    expect(result.css[result.css.length - 1].selectorsAdd).toBe('#container, #title, #field');
  });

  it('overrides an LLM text-style result while retaining its wording and other styling', () => {
    const llmPage = page();
    llmPage.components[0].components[0].content = 'Bonjour';
    llmPage.components[0].components[0].style = { 'font-size': '10px !important', 'font-weight': 'bold' };
    const result = applyGuiPresentation(llmPage, { size: 28 }, 'home');
    expect(result.components[0].components[0]).toMatchObject({ content: 'Bonjour', style: { 'font-size': '28px !important', 'font-weight': 'bold' } });
  });

  it('does nothing for an empty rule set and replaces its CSS rule on repeat application', () => {
    expect(applyGuiPresentation(page(), {}, 'home')).toEqual(page());
    const once = applyGuiPresentation(page(), { size: 24 }, 'home');
    expect(applyGuiPresentation(once, { size: 24 }, 'home')).toEqual(once);
  });

  it('pairs an explicit light text color with a dark high-contrast background', () => {
    const result = applyGuiPresentation(page(), { color: '#ffffff', contrast: 'high' }, 'home');
    expect(result.components[0].style).toMatchObject({ color: '#ffffff !important', 'background-color': '#000000 !important' });
  });

  it('includes the applied rules in generated profile models and preserves the Base model', () => {
    const base = page();
    const variant = applyGuiPresentation(base, { size: 24 }, 'home');
    const model = { pages: [{ id: 'home', frames: [{ component: { components: base.components } }], besserBaseSnapshot: JSON.stringify(base), besserPageVariants: JSON.stringify([{ id: 'v', profileId: 'alice', profileName: 'Alice', snapshot: variant }]) }], styles: base.css } as any;
    expect((buildVersionGuiModel(model, 'alice').pages![0] as any).frames[0].component.components[0].style['font-size']).toBe('24px !important');
    expect((buildVersionGuiModel(model, null).pages![0] as any).frames[0].component.components).toEqual(base.components);
  });
});
