import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasKeyHandlers } from '../canvasKeys';

let container: HTMLDivElement;
let outsideButton: HTMLButtonElement;
let insideInput: HTMLInputElement;

beforeEach(() => {
  container = document.createElement('div');
  container.tabIndex = 0;
  insideInput = document.createElement('input');
  container.appendChild(insideInput);
  outsideButton = document.createElement('button');
  document.body.append(container, outsideButton);
});
afterEach(() => {
  document.body.innerHTML = '';
});

function setup(overrides: Partial<Parameters<typeof createCanvasKeyHandlers>[0]> = {}) {
  const deps = {
    getContainer: () => container,
    setPanning: vi.fn(),
    getSelection: vi.fn(() => ({ nodeIds: ['a'], edgeIds: [] as string[] })),
    getConnectMode: vi.fn(() => 'off' as const),
    exitConnectMode: vi.fn(),
    requestDelete: vi.fn(),
    ...overrides,
  };
  return { deps, ...createCanvasKeyHandlers(deps) };
}

const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });

describe('Space and Delete belong to the canvas only while it has focus', () => {
  it('leaves Space alone on a button elsewhere, so the button can be pressed', () => {
    const { deps, onKeyDown } = setup();
    outsideButton.focus();
    const ev = key(' ');

    onKeyDown(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(deps.setPanning).not.toHaveBeenCalled();
  });

  it('leaves Delete and Backspace alone on a button elsewhere, e.g. in a confirm dialog', () => {
    const { deps, onKeyDown } = setup();
    outsideButton.focus();

    for (const k of ['Delete', 'Backspace']) {
      const ev = key(k);
      onKeyDown(ev);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(deps.requestDelete).not.toHaveBeenCalled();
  });

  it('pans while Space is held with the canvas focused, and stops on release', () => {
    const { deps, onKeyDown, onKeyUp } = setup();
    container.focus();
    const ev = key(' ');

    onKeyDown(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(deps.setPanning).toHaveBeenLastCalledWith(true);

    onKeyUp(new KeyboardEvent('keyup', { key: ' ' }));
    expect(deps.setPanning).toHaveBeenLastCalledWith(false);
  });

  it('does not restart panning on the auto-repeat of a held Space, but still keeps the page from scrolling', () => {
    const { deps, onKeyDown } = setup();
    container.focus();
    const ev = key(' ', { repeat: true });

    onKeyDown(ev);

    expect(deps.setPanning).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);
  });

  it('stops panning on Space release even if focus has moved away meanwhile', () => {
    const { deps, onKeyDown, onKeyUp } = setup();
    container.focus();
    onKeyDown(key(' '));
    outsideButton.focus();

    onKeyUp(new KeyboardEvent('keyup', { key: ' ' }));

    expect(deps.setPanning).toHaveBeenLastCalledWith(false);
  });

  it('asks to delete the selection on Delete or Backspace with the canvas focused', () => {
    const { deps, onKeyDown } = setup({ getSelection: vi.fn(() => ({ nodeIds: ['a', 'b'], edgeIds: ['e'] })) });
    container.focus();

    for (const k of ['Delete', 'Backspace']) {
      const ev = key(k);
      onKeyDown(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(deps.requestDelete).toHaveBeenCalledTimes(2);
    expect(deps.requestDelete).toHaveBeenCalledWith({ nodeIds: ['a', 'b'], edgeIds: ['e'] });
  });

  it('does nothing on Delete when nothing is selected', () => {
    const { deps, onKeyDown } = setup({ getSelection: vi.fn(() => ({ nodeIds: [], edgeIds: [] })) });
    container.focus();
    const ev = key('Delete');

    onKeyDown(ev);

    expect(deps.requestDelete).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('never steals keys from a text field, even one inside the canvas container', () => {
    const { deps, onKeyDown } = setup();
    insideInput.focus();

    for (const k of [' ', 'Delete', 'Backspace']) onKeyDown(key(k));

    expect(deps.setPanning).not.toHaveBeenCalled();
    expect(deps.requestDelete).not.toHaveBeenCalled();
  });

  it('does nothing before the canvas exists', () => {
    const { deps, onKeyDown } = setup({ getContainer: () => null });

    onKeyDown(key('Delete'));

    expect(deps.requestDelete).not.toHaveBeenCalled();
  });
});

describe('Escape', () => {
  it('leaves connect mode even when focus is on the toolbar button that started it', () => {
    const { deps, onKeyDown } = setup({ getConnectMode: vi.fn(() => 'connect' as const) });
    outsideButton.focus();
    const ev = key('Escape');

    onKeyDown(ev);

    expect(deps.exitConnectMode).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('is left for others when not connecting', () => {
    const { deps, onKeyDown } = setup();
    container.focus();
    const ev = key('Escape');

    onKeyDown(ev);

    expect(deps.exitConnectMode).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('is not taken from a text field', () => {
    const { deps, onKeyDown } = setup({ getConnectMode: vi.fn(() => 'connect' as const) });
    insideInput.focus();

    onKeyDown(key('Escape'));

    expect(deps.exitConnectMode).not.toHaveBeenCalled();
  });
});
