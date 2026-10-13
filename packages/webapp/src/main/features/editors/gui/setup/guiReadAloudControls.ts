import type { Editor } from 'grapesjs';
import { requestGuiAudio } from './guiAudio';

const CONTROL_ATTRIBUTE = 'data-besser-read-aloud-preview';

export function isReadAloudVariant(page: any): boolean {
  const activeId = page?.get?.('besserActiveVariantId');
  if (!activeId) return false;
  try {
    const raw = page.get('besserPageVariants');
    const variants = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const variant = Array.isArray(variants) && variants.find(value => value.id === activeId);
    if (!variant) return false;
    if (typeof variant.readAloudEnabled === 'boolean') return variant.readAloudEnabled;
    const components = page.getMainComponent?.()?.components?.()?.toJSON?.() ?? variant.snapshot?.components;
    const requested = (nodes: any[]): boolean => Array.isArray(nodes) && nodes.some(node =>
      node?.attributes?.['data-besser-read-aloud'] === 'true' || node?.attributes?.['data-besser-read-aloud'] === true || requested(node?.components));
    return requested(components);
  } catch { return false; }
}

function eligibleElements(body: HTMLElement, root: any) {
  const result: { component: any; element: HTMLElement; summary: boolean }[] = [];
  const visit = (component: any) => {
    const attrs = component.getAttributes?.() ?? {};
    // GrapesJS textnode views return DOM Text nodes. Use nodeType rather than
    // instanceof HTMLElement because canvas elements belong to an iframe.
    const node = component.getEl?.() as Node | undefined;
    const element = node?.nodeType === 1 ? node as HTMLElement : undefined;
    const tag = element?.tagName.toLowerCase();
    if ((attrs['data-besser-read-aloud'] === 'true' || attrs['data-besser-read-aloud'] === true) && element && body.contains(element) &&
        !['span', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag || '') &&
        !element.closest('form,table,button,code,pre,[data-binding],[data-source]') &&
        !element.querySelector('input,textarea,select,table,script,style,code,pre,svg,iframe,form,button,[data-binding],[data-source]') &&
        element.textContent?.trim() && !/\{\{.*?\}\}|\$\{.*?\}|\{[\w.]+\}|https?:\/\/\S+/s.test(element.textContent)) {
      result.push({ component, element, summary: !!attrs['data-besser-gui-summary'] });
      return;
    }
    component.components?.()?.forEach?.(visit);
  };
  visit(root);
  return result;
}

function createControl(element: HTMLElement, summary: boolean, onPlay: () => void, onStop: () => void) {
  const doc = element.ownerDocument;
  const group = doc.createElement('div');
  group.setAttribute(CONTROL_ATTRIBUTE, 'true');
  group.setAttribute('data-gjs-selectable', 'false');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', summary ? 'Summary audio' : 'Text audio');
  group.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0 16px;';
  group.style.fontSize = doc.defaultView?.getComputedStyle(element).fontSize || 'inherit';
  const play = doc.createElement('button');
  play.type = 'button';
  play.textContent = summary ? '▶ Play summary' : '▶ Play';
  play.setAttribute('aria-label', summary ? 'Listen to summary' : 'Listen to this text');
  play.style.cssText = 'display:inline-flex;align-items:center;padding:6px 12px;min-height:34px;border:1px solid #1d4ed8;border-radius:6px;background:#fff;color:#1d4ed8;font:600 1em/1.2 system-ui,sans-serif;cursor:pointer;';
  const stop = doc.createElement('button');
  stop.type = 'button'; stop.textContent = '■ Stop'; stop.disabled = true;
  stop.setAttribute('aria-label', 'Stop');
  stop.style.cssText = 'padding:6px 12px;min-height:34px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font:600 1em/1.2 system-ui,sans-serif;cursor:pointer;';
  const status = doc.createElement('span');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'color:#475569;font:0.85em/1.4 system-ui,sans-serif;';
  group.addEventListener('pointerdown', event => event.stopPropagation());
  group.addEventListener('mousedown', event => event.stopPropagation());
  play.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onPlay(); });
  stop.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onStop(); });
  group.append(play, stop, status);
  element.after(group);
  return { group, play, stop, status, summary };
}

/** Render-only helper, also used to verify controls never enter serialized models. */
export function renderReadAloudControls(body: HTMLElement, root: any, listen: (component: any) => void) {
  body.querySelectorAll(`[${CONTROL_ATTRIBUTE}]`).forEach(control => control.remove());
  eligibleElements(body, root).forEach(({ component, element, summary }) => createControl(element, summary, () => listen(component), () => {}));
}

type Record = ReturnType<typeof createControl> & {
  component: any; fingerprint: string; audio?: HTMLAudioElement; url?: string;
  request?: AbortController; disposed: boolean;
};

/** Own previews only for this editor's current page/variant and mounted lifetime. */
export function setupGuiReadAloudControls(editor: Editor) {
  const records = new Map<any, Record>();
  let pending: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  let context = '';
  let playbackIntent = 0;
  const getContext = () => {
    const page = editor.Pages.getSelected();
    return JSON.stringify([page?.getId(), page?.get('besserActiveVariantId')]);
  };
  const resetLabel = (record: Record) => {
    record.play.textContent = record.summary ? '▶ Play summary' : '▶ Play';
    record.play.setAttribute('aria-pressed', 'false');
    record.play.setAttribute('aria-label', record.summary ? 'Listen to summary' : 'Listen to this text');
  };
  const releaseAudio = (record: Record) => {
    record.request?.abort(); record.request = undefined;
    if (record.audio) { record.audio.pause(); record.audio.removeAttribute('src'); record.audio.load(); record.audio.remove(); record.audio = undefined; }
    if (record.url) { URL.revokeObjectURL(record.url); record.url = undefined; }
  };
  const dispose = (record: Record) => { record.disposed = true; releaseAudio(record); record.group.remove(); };
  const clear = () => { playbackIntent++; records.forEach(dispose); records.clear(); };
  const showError = (record: Record, error: unknown) => {
    if (record.disposed) return;
    record.play.disabled = false; resetLabel(record); record.stop.disabled = true;
    record.status.setAttribute('role', 'alert'); record.status.style.color = '#b91c1c';
    record.status.textContent = error instanceof Error ? error.message : 'Audio preview failed. Press Play to try again.';
  };
  const play = async (record: Record) => {
    if (record.disposed || record.request) return;
    if (record.audio && !record.audio.paused) { record.audio.pause(); return; }
    const intent = ++playbackIntent;
    records.forEach(other => { if (other !== record) other.audio?.pause(); });
    record.status.setAttribute('role', 'status'); record.status.style.color = '#475569';
    let ownRequest: AbortController | undefined;
    try {
      if (!record.audio) {
        const request = ownRequest = record.request = new AbortController();
        record.play.disabled = true; record.play.textContent = 'Generating…'; record.stop.disabled = false;
        record.group.setAttribute('aria-busy', 'true'); record.status.textContent = 'Generating audio…';
        const blob = await requestGuiAudio({ components: [record.component.toJSON()], css: [] }, record.component.getAttributes?.().lang, request.signal);
        if (record.disposed || request.signal.aborted || getContext() !== context || !isReadAloudVariant(editor.Pages.getSelected()) || JSON.stringify(record.component.toJSON()) !== record.fingerprint) return;
        record.request = undefined;
        record.url = URL.createObjectURL(blob);
        const audio = record.audio = record.group.ownerDocument.createElement('audio');
        audio.src = record.url; audio.preload = 'metadata'; audio.hidden = true;
        audio.addEventListener('play', () => { if (!record.disposed) { record.play.textContent = 'Ⅱ Pause'; record.play.setAttribute('aria-label', 'Pause'); record.play.setAttribute('aria-pressed', 'true'); record.stop.disabled = false; } });
        const paused = () => { if (!record.disposed) resetLabel(record); };
        audio.addEventListener('pause', paused); audio.addEventListener('ended', paused);
        audio.addEventListener('error', () => { if (!record.disposed && audio.hasAttribute('src')) { releaseAudio(record); showError(record, new Error('Audio could not be played. Press Play to generate it again.')); } });
        record.group.append(audio);
      }
      record.play.disabled = false; resetLabel(record); record.group.setAttribute('aria-busy', 'false');
      record.status.textContent = 'AI-generated voice'; record.stop.disabled = false;
      if (intent === playbackIntent && record.audio) await record.audio.play();
    } catch (error) {
      if (!record.disposed && !(error instanceof DOMException && error.name === 'AbortError')) showError(record, error);
    } finally {
      if (!record.disposed && (!ownRequest || record.request === ownRequest || (!record.request && !ownRequest.signal.aborted))) { record.request = undefined; record.play.disabled = false; record.group.setAttribute('aria-busy', 'false'); }
    }
  };
  const stop = (record: Record) => {
    playbackIntent++;
    if (record.request) { record.request.abort(); record.request = undefined; }
    if (record.audio) { record.audio.pause(); record.audio.currentTime = 0; }
    record.play.disabled = false; resetLabel(record); record.group.setAttribute('aria-busy', 'false');
    record.stop.disabled = !record.audio; record.status.textContent = record.audio ? 'AI-generated voice' : '';
  };
  const refresh = () => {
    const next = getContext();
    if (context !== next) { clear(); context = next; }
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      if (destroyed) return;
      const body = editor.Canvas?.getBody?.();
      const page = editor.Pages.getSelected();
      if (!body || !page || !isReadAloudVariant(page)) { clear(); return; }
      const present = new Set<any>();
      for (const { component, element, summary } of eligibleElements(body, page.getMainComponent())) {
        present.add(component);
        const fingerprint = JSON.stringify(component.toJSON());
        let record = records.get(component);
        if (record && (record.fingerprint !== fingerprint || record.group.ownerDocument !== body.ownerDocument)) { dispose(record); records.delete(component); record = undefined; }
        if (!record) {
          const view = createControl(element, summary, () => { const current = records.get(component); if (current) void play(current); }, () => { const current = records.get(component); if (current) stop(current); });
          records.set(component, { ...view, component, fingerprint, disposed: false });
        } else if (element.nextElementSibling !== record.group) element.after(record.group);
      }
      records.forEach((record, component) => { if (!present.has(component)) { dispose(record); records.delete(component); } });
    }, 30);
  };
  const release = () => { clear(); refresh(); };
  const hidden = () => { if (document.hidden) clear(); else refresh(); };
  const events = ['component:mount', 'component:update', 'component:add', 'component:remove', 'page:select', 'page:update'];
  const frameEvents = ['canvas:frame:load', 'canvas:frame:load:body'];
  events.forEach(event => editor.on(event, refresh));
  frameEvents.forEach(event => editor.on(event, release));
  window.addEventListener('pagehide', clear); window.addEventListener('beforeunload', clear);
  document.addEventListener('visibilitychange', hidden);
  const destroy = () => {
    destroyed = true; if (pending) clearTimeout(pending); clear();
    events.forEach(event => editor.off(event, refresh)); frameEvents.forEach(event => editor.off(event, release));
    window.removeEventListener('pagehide', clear); window.removeEventListener('beforeunload', clear);
    document.removeEventListener('visibilitychange', hidden); editor.off('destroy', destroy);
  };
  editor.on('destroy', destroy);
  refresh();
  return destroy;
}
