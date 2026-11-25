import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupPageSystem } from '../setup/setupPageSystem';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { apiClient } from '../../../../shared/api/api-client';
import { globalConfirm } from '../../../../shared/services/confirm/globalConfirm';
import {
  GUI_PERSONALIZE_EVENT,
  GUI_VARIANT_SELECT_EVENT,
  GUI_VARIANTS_STATE_EVENT,
  type GuiVariantsState,
} from '../../../../shared/constants/gui-personalize-event';

vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { getCurrentProject: vi.fn() },
}));
vi.mock('../../../../shared/api/api-client', () => ({
  apiClient: { post: vi.fn() },
  ApiError: class extends Error {},
}));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));

const userModel = (size?: number) => ({
  type: 'UserDiagram',
  elements: {
    user: { id: 'user', type: 'UserModelName', className: 'User', attributes: ['name'], ...(size ? { personalization: { gui: { presentation: { size } } } } : {}) },
    name: { id: 'name', type: 'UserModelAttribute', name: 'name = Alice', owner: 'user' },
  },
  relationships: {},
});

const createdEditors: any[] = [];

function createEditor(withTextNode = false) {
  const attrs: Record<string, any> = {};
  let components: any[] = [{ type: 'text', tagName: 'p', attributes: { id: 'message' }, content: 'Hello', style: { 'font-size': '12px' } }];
  if (withTextNode) {
    const text = document.createTextNode('Hello');
    components[0].components = () => ({ forEach: (fn: (c: any) => void) => fn({ getEl: () => text, getId: () => 'textnode' }) });
  }
  const rules: any[] = [];
  const commands = new Map<string, any>();
  const main = { components: () => ({ toJSON: () => components, forEach: (fn: (c: any) => void) => components.forEach(fn), reset: (next: any[]) => { components = next; } }) };
  const page = { getId: () => 'home', getName: () => 'Home', getMainComponent: () => main, get: (key: string) => attrs[key], set: (key: string, value: any) => { attrs[key] = value; } };
  const editor: any = {
    Panels: {},
    off: vi.fn(),
    on: vi.fn((event: string, fn: () => void) => { if (event === 'destroy') (editor.__destroyHandlers ??= []).push(fn); }),
    Commands: { add: (key: string, command: any) => commands.set(key, command) },
    runCommand: (key: string) => commands.get(key)?.run(editor),
    Pages: { getAll: () => [page], getSelected: () => page },
    Css: {
      getComponentRules: () => [],
      getAll: () => ({ forEach: (fn: (r: any) => void) => rules.forEach(fn), add: (rule: any) => rules.push({ toJSON: () => rule }) }),
      remove: (rule: any) => rules.splice(rules.indexOf(rule), 1),
    },
    Modal: {
      setTitle: vi.fn(), open: vi.fn(),
      setContent: (content: string | HTMLElement) => { if (typeof content === 'string') document.getElementById('modal')!.innerHTML = content; else document.getElementById('modal')!.replaceChildren(content); },
      close: () => { document.getElementById('modal')!.innerHTML = ''; },
    },
  };
  setupPageSystem(editor);
  createdEditors.push(editor);
  editor.runCommand('open-pages-tab');
  return { page, getComponents: () => components };
}

async function openPicker() {
  await vi.advanceTimersByTimeAsync(20);
  window.dispatchEvent(new CustomEvent(GUI_PERSONALIZE_EVENT));
  await vi.advanceTimersByTimeAsync(60);
}

async function confirmChoices() {
  document.getElementById('gjs-personalization-confirm-btn')!.click();
  await vi.advanceTimersByTimeAsync(20);
}

const confirmDisabled = () => (document.getElementById('gjs-personalization-confirm-btn') as HTMLButtonElement).disabled;

function selectVariant(variantId: string | null) {
  window.dispatchEvent(new CustomEvent(GUI_VARIANT_SELECT_EVENT, { detail: { variantId } }));
}

describe('GUI page personalization panel', () => {
  it('hides audio on Base and on variants without an applied read-aloud request', async () => {
    createEditor();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelector('.audio-page-btn')).toBeNull();
    await openPicker();
    await confirmChoices();
    expect(document.querySelector('.audio-page-btn')).toBeNull();
  });

  it('enables read-aloud-only rules without automatic synthesis', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui as any) = { modality: { readAloud: true } };
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    const editor = createEditor();
    await openPicker();
    expect(confirmDisabled()).toBe(false);
    await confirmChoices();
    expect(editor.getComponents()[0].attributes['data-besser-read-aloud']).toBe('true');
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(document.querySelector('.audio-page-btn')).toBeNull();
    const hint = document.querySelector('.gjs-page-audio-hint')!;
    expect(hint.textContent).toContain('Play in the canvas');
    expect(getComputedStyle(hint).color).toBe('rgb(255, 255, 255)');
    selectVariant(null);
    await vi.advanceTimersByTimeAsync(40);
    expect(document.querySelector('.audio-page-btn')).toBeNull();
  });

  it('enables summary-only rules without general AI and mounts the summary above the full text', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui as any) = { content: { summarizeLongContent: true } };
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    vi.mocked(apiClient.post).mockResolvedValue({ guiPage: { components: [
      { type: 'text', tagName: 'p', content: '<strong>Summary</strong><br/>A short overview.', attributes: { 'data-besser-gui-summary': 'true' } },
      { type: 'text', tagName: 'p', content: 'Hello' },
    ], css: [] } });
    const editor = createEditor();
    await openPicker();
    expect(confirmDisabled()).toBe(false);
    await confirmChoices();
    expect(apiClient.post).toHaveBeenCalledWith('/personalize-gui-page', expect.objectContaining({
      adaptFromProfile: false,
      guiPersonalization: { presentation: {}, content: { summarizeLongContent: true } },
    }), expect.anything());
    expect(editor.getComponents()[0].content).toContain('A short overview.');
    expect(editor.getComponents()[1].content).toBe('Hello');
    expect(JSON.parse(editor.page.get('besserBaseSnapshot')).components).toHaveLength(1);
  });

  it('enables content-only rules and sends the selected profile without general AI', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui as any) = { content: { adaptContentToUserProfile: true } };
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    const editor = createEditor();
    await openPicker();
    expect(confirmDisabled()).toBe(false);
    await confirmChoices();
    expect(apiClient.post).toHaveBeenCalledWith('/personalize-gui-page', expect.objectContaining({
      adaptFromProfile: false,
      userProfileModel: expect.any(Object),
      guiPersonalization: { presentation: {}, content: { adaptContentToUserProfile: true } },
    }), expect.anything());
    expect(editor.getComponents()[0].content).toBe('Bonjour');
    expect(JSON.parse(editor.page.get('besserBaseSnapshot')).components[0].content).toBe('Hello');
  });

  it('calls the backend for sentence length as the only rule without general AI', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui as any).presentation = { sentenceLength: 'concise' };
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    const editor = createEditor();
    await openPicker();
    await confirmChoices();
    expect(apiClient.post).toHaveBeenCalledWith('/personalize-gui-page', expect.objectContaining({
      adaptFromProfile: false,
      guiPersonalization: { presentation: { sentenceLength: 'concise' } },
    }), expect.anything());
    expect(editor.getComponents()[0].content).toBe('Bonjour');
    expect(JSON.parse(editor.page.get('besserBaseSnapshot')).components[0].content).toBe('Hello');
  });

  it('translates through the backend without general AI or Simple text and preserves Base', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui.presentation as any).language = 'french';
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    const editor = createEditor();
    await openPicker();
    await confirmChoices();
    expect(apiClient.post).toHaveBeenCalledWith('/personalize-gui-page', expect.objectContaining({
      adaptFromProfile: false,
      guiPersonalization: { presentation: { size: 24, language: 'french' } },
    }), expect.anything());
    expect(editor.getComponents()[0]).toMatchObject({ content: 'Bonjour', style: { 'font-size': '24px !important' } });
    expect(JSON.parse(editor.page.get('besserBaseSnapshot')).components[0].content).toBe('Hello');
  });

  it('calls the backend for Simple text even when general AI adaptation is unchecked', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui.presentation as any).languageComplexity = 'simple';
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    const editor = createEditor();
    await openPicker();
    await confirmChoices();
    expect(apiClient.post).toHaveBeenCalledWith('/personalize-gui-page', expect.objectContaining({
      adaptFromProfile: false,
      guiPersonalization: { presentation: { size: 24, languageComplexity: 'simple' } },
    }), expect.anything());
    expect(editor.getComponents()[0]).toMatchObject({ content: 'Bonjour', style: { 'font-size': '24px !important' } });
    expect(JSON.parse(editor.page.get('besserBaseSnapshot')).components[0].content).toBe('Hello');
  });

  it('applies rules when the live editor contains DOM text nodes', async () => {
    const editor = createEditor(true);
    await openPicker();
    await confirmChoices();
    expect(editor.getComponents()[0].style['font-size']).toBe('24px !important');
    expect(editor.page.get('besserPageVariants')).toBeDefined();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="gjs-pages-panel"><div id="gjs-pages-list"></div></div><div id="modal"></div>';
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model: userModel(24) }] } } as any);
    vi.mocked(globalConfirm).mockResolvedValue(true);
    vi.mocked(apiClient.post).mockResolvedValue({ guiPage: { components: [{ type: 'text', tagName: 'p', content: 'Bonjour', style: { 'font-size': '10px' } }], css: [] } });
  });
  afterEach(() => {
    createdEditors.splice(0).forEach((editor) => (editor.__destroyHandlers ?? []).forEach((fn: () => void) => fn()));
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('applies rules without calling the LLM, saves a variant, and preserves Base', async () => {
    const editor = createEditor();
    await openPicker();
    await confirmChoices();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(editor.getComponents()[0].style['font-size']).toBe('24px !important');
    expect(JSON.parse(editor.page.get('besserPageVariants'))[0].snapshot.components[0].style['font-size']).toBe('24px !important');
    expect(JSON.parse(editor.page.get('besserBaseSnapshot')).components[0].style['font-size']).toBe('12px');
  });

  it('updates rule availability when the selected profile changes', async () => {
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [
      { id: 'users', title: 'Users', model: userModel(24) },
      { id: 'empty', title: 'No rules', model: userModel() },
    ] } } as any);
    createEditor();
    await openPicker();
    expect(confirmDisabled()).toBe(false);
    expect(document.getElementById('gjs-personalization-ai-toggle')).toBeNull();
    expect(document.getElementById('gjs-personalization-rules-toggle')).toBeNull();
    const select = document.getElementById('gjs-personalization-profile-select') as HTMLSelectElement;
    select.value = 'empty';
    select.dispatchEvent(new Event('change'));
    expect(confirmDisabled()).toBe(true);
    expect(document.getElementById('gjs-personalization-rules-status')!.textContent).toContain('No GUI rules defined');
  });

  it('can fall back to the visual rules if the LLM fails', async () => {
    const model = userModel(24);
    (model.elements.user.personalization!.gui.presentation as any).languageComplexity = 'simple';
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({ diagrams: { UserDiagram: [{ id: 'users', title: 'Users', model }] } } as any);
    vi.mocked(apiClient.post).mockRejectedValue(new Error('LLM unavailable'));
    const editor = createEditor();
    await openPicker();
    await confirmChoices();
    expect(globalConfirm).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Apply visual rules' }));
    expect(editor.getComponents()[0]).toMatchObject({ content: 'Hello', style: { 'font-size': '24px !important' } });
  });

  it('keeps the page cards free of personalization controls', async () => {
    createEditor();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelector('.add-variant-btn')).toBeNull();
    expect(document.querySelector('.gjs-page-variants-select')).toBeNull();
  });

  it('shares the variants of the selected page with the top bar and switches them on request', async () => {
    const states: GuiVariantsState[] = [];
    const onState = (event: Event) => states.push((event as CustomEvent<GuiVariantsState>).detail);
    window.addEventListener(GUI_VARIANTS_STATE_EVENT, onState);
    const editor = createEditor();
    await openPicker();
    await confirmChoices();
    const afterCreate = states[states.length - 1];
    expect(afterCreate.options).toHaveLength(1);
    expect(afterCreate.activeId).toBe(afterCreate.options[0].id);
    selectVariant(null);
    await vi.advanceTimersByTimeAsync(40);
    expect(states[states.length - 1].activeId).toBeNull();
    expect(editor.getComponents()[0].style['font-size']).toBe('12px');
    selectVariant(afterCreate.options[0].id);
    await vi.advanceTimersByTimeAsync(40);
    expect(states[states.length - 1].activeId).toBe(afterCreate.options[0].id);
    expect(editor.getComponents()[0].style['font-size']).toBe('24px !important');
    window.removeEventListener(GUI_VARIANTS_STATE_EVENT, onState);
  });
});
