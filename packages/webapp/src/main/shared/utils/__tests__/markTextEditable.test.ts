import { describe, it, expect } from 'vitest';
import { markTextEditable } from '../markTextEditable';

describe('markTextEditable', () => {
  it('coerces a bare <p> with a textnode child to editable text', () => {
    const node: any = { tagName: 'p', components: [{ type: 'textnode', content: 'hi' }] };
    markTextEditable(node);
    expect(node.type).toBe('text');
    expect(node.editable).toBe(true);
  });

  it('marks an existing type:"text" node editable', () => {
    const node: any = { type: 'text', tagName: 'h1', components: [{ type: 'textnode', content: 'Title' }] };
    markTextEditable(node);
    expect(node.type).toBe('text');
    expect(node.editable).toBe(true);
  });

  it('leaves a genuine container (div with element children) untouched', () => {
    const node: any = {
      tagName: 'div',
      components: [
        { tagName: 'p', components: [{ type: 'textnode', content: 'inner' }] },
        { tagName: 'span', components: [{ type: 'textnode', content: 'x' }] },
      ],
    };
    markTextEditable(node);
    // The div itself is not a text tag -> untouched.
    expect(node.type).toBeUndefined();
    expect(node.editable).toBeUndefined();
    // But its bare-<p> child IS coerced (recursion works).
    expect(node.components[0].type).toBe('text');
    expect(node.components[0].editable).toBe(true);
    expect(node.components[1].type).toBe('text');
  });

  it('does NOT coerce a text-tag that holds element children', () => {
    // <li> containing a nested <ul> is a container, not editable text.
    const node: any = {
      tagName: 'li',
      components: [{ tagName: 'ul', components: [{ tagName: 'li' }] }],
    };
    markTextEditable(node);
    expect(node.type).toBeUndefined();
    expect(node.editable).toBeUndefined();
  });

  it('does not override an explicit non-text component type (e.g. link)', () => {
    const node: any = { tagName: 'a', type: 'link', components: [{ type: 'textnode', content: 'click' }] };
    markTextEditable(node);
    expect(node.type).toBe('link');
    expect(node.editable).toBeUndefined();
  });

  it('recurses through a GrapesJS project-data shape (pages/frames/component)', () => {
    const model: any = {
      pages: [
        {
          frames: [
            {
              component: {
                type: 'wrapper',
                components: [
                  { tagName: 'h2', type: 'text', components: [{ type: 'textnode', content: 'Heading' }] },
                  { tagName: 'p', components: [{ type: 'textnode', content: 'Body' }] },
                ],
              },
            },
          ],
        },
      ],
    };
    markTextEditable(model);
    const wrapper = model.pages[0].frames[0].component;
    expect(wrapper.components[0].editable).toBe(true); // existing text node
    expect(wrapper.components[1].type).toBe('text'); // coerced bare <p>
    expect(wrapper.components[1].editable).toBe(true);
  });

  it('is a no-op on a UML class-diagram model (no tagName / text nodes)', () => {
    const umlModel: any = {
      version: '3.0.0',
      type: 'ClassDiagram',
      elements: { e1: { id: 'e1', type: 'Class', name: 'Book' } },
      relationships: {},
    };
    const before = JSON.stringify(umlModel);
    markTextEditable(umlModel);
    expect(JSON.stringify(umlModel)).toBe(before);
  });
});
