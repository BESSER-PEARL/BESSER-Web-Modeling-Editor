import grapesjs, { type Component } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isReadAloudVariant, renderReadAloudControls } from '../setup/guiReadAloudControls';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('read-aloud controls on the editor canvas', () => {
  it('traverses GrapesJS text nodes in headings before rendering paragraph controls', () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      const frame = document.createElement('iframe'); document.body.append(frame);
      const canvas = frame.contentDocument!;
      editor.setComponents([
        { type: 'text', tagName: 'h1', attributes: { 'data-besser-read-aloud': 'true' }, components: [{ type: 'textnode', content: 'Welcome' }] },
        { type: 'text', tagName: 'p', attributes: { 'data-besser-read-aloud': 'true' }, components: [{ type: 'textnode', content: 'Take the elevator.' }] },
      ]);
      const root = editor.Components.getWrapper()!;
      root.components().forEach((component: Component) => {
        const element = canvas.createElement(component.get('tagName')!);
        const text = canvas.createTextNode(component.components().at(0).get('content')!);
        element.append(text); canvas.body.append(element);
        vi.spyOn(component, 'getEl').mockReturnValue(element);
        vi.spyOn(component.components().at(0), 'getEl').mockReturnValue(text as unknown as HTMLElement);
      });
      renderReadAloudControls(canvas.body, root, vi.fn());
      expect(canvas.querySelectorAll('[data-besser-read-aloud-preview]')).toHaveLength(1);
      expect(canvas.querySelector('p')!.nextElementSibling?.querySelector('button')?.textContent).toContain('Play');
    } finally { editor.destroy(); }
  });
  it('requires both personalization and an applied read-aloud request', () => {
    const components = [{ type: 'text', attributes: { 'data-besser-read-aloud': 'true' } }];
    const attrs: any = { besserActiveVariantId: null, besserPageVariants: JSON.stringify([{ id: 'alice', snapshot: { components } }]) };
    const page = { get: (key: string) => attrs[key], getMainComponent: () => ({ components: () => ({ toJSON: () => components }) }) };
    expect(isReadAloudVariant(page)).toBe(false);
    attrs.besserActiveVariantId = 'alice';
    expect(isReadAloudVariant(page)).toBe(true);
    attrs.besserPageVariants = JSON.stringify([{ id: 'alice', readAloudEnabled: false, snapshot: { components } }]);
    expect(isReadAloudVariant(page)).toBe(false);
  });
  it('adds one Listen control per text block, including summaries, without changing the model or export HTML', () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      editor.setComponents([
        { type: 'text', tagName: 'p', content: 'Take the elevator.', attributes: { 'data-besser-read-aloud': 'true' } },
        { type: 'text', tagName: 'p', content: 'A short summary.', attributes: { 'data-besser-read-aloud': 'true', 'data-besser-gui-summary': 'true' } },
      ]);
      const root = editor.Components.getWrapper()!;
      root.components().forEach((component: Component) => {
        const element = document.createElement('p');
        element.textContent = component.get('content') ?? '';
        document.body.append(element);
        vi.spyOn(component, 'getEl').mockReturnValue(element);
      });
      const model = JSON.stringify(root.toJSON());
      const html = editor.getHtml();
      const listen = vi.fn();
      renderReadAloudControls(document.body, root, listen);
      const buttons = document.querySelectorAll<HTMLButtonElement>('button[aria-pressed],button[aria-label^="Listen"]');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].textContent).toContain('Play');
      expect(buttons[1].textContent).toContain('Play summary');
      buttons[0].click();
      expect(listen).toHaveBeenCalledWith(root.components().at(0));
      expect(JSON.stringify(root.toJSON())).toBe(model);
      expect(editor.getHtml()).toBe(html);
      renderReadAloudControls(document.body, root, listen);
      expect(document.querySelectorAll('[data-besser-read-aloud-preview]')).toHaveLength(2);
    } finally { editor.destroy(); }
  });

  it('removes controls when switching to a page without read-aloud and excludes dynamic text', () => {
    document.body.innerHTML = '<p id="text">Take the elevator.</p><p id="dynamic">Hello {{user.name}}</p>';
    const component = { getAttributes: () => ({ 'data-besser-read-aloud': 'true' }), getEl: () => document.getElementById('text') };
    renderReadAloudControls(document.body, component, vi.fn());
    expect(document.querySelectorAll('[data-besser-read-aloud-preview]')).toHaveLength(1);
    renderReadAloudControls(document.body, { getAttributes: component.getAttributes, getEl: () => document.getElementById('dynamic') }, vi.fn());
    expect(document.querySelectorAll('button')).toHaveLength(0);
    renderReadAloudControls(document.body, { getAttributes: () => ({}), getEl: component.getEl }, vi.fn());
    expect(document.querySelectorAll('button')).toHaveLength(0);
  });
});
