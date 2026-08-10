import React, { useEffect, useRef } from 'react';
import type { Editor } from 'grapesjs';
import '../editors/gui/grapesjs-styles.css';
import { registerAllComponents } from '../editors/gui/registerAllComponents';
import {
  GrapesJSProjectData,
  isGrapesJSProjectData,
  normalizeToGrapesJSProjectData,
  createDefaultGUITemplate,
} from '../../shared/types/project';

export interface AgentGUIEditorProps {
  initialData?: GrapesJSProjectData | null;
  onSave: (data: GrapesJSProjectData) => void;
  onCancel: () => void;
}

export function AgentGUIEditor({ initialData, onSave, onCancel }: AgentGUIEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Give each mount its own wrapper div so that React Strict Mode's
    // double-effect (mount → sync cleanup → remount) doesn't cause the two
    // grapesjs.init() / editor.destroy() calls to share and clobber the same
    // container element (both operations call container.empty() internally).
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;';
    containerRef.current.appendChild(wrapper);

    let cancelled = false;

    (async () => {
      try {
        // Deep-clone via JSON round-trip to produce a fresh, unfrozen plain
        // object. Redux Toolkit (Immer) freezes store objects in development
        // mode; GrapesJS mutates page/component data during loadData() and
        // throws a silent TypeError on frozen objects, leaving the canvas empty.
        const projectData =
          initialData &&
          isGrapesJSProjectData(initialData) &&
          (initialData.pages?.length ?? 0) > 0
            ? (JSON.parse(JSON.stringify(initialData)) as GrapesJSProjectData)
            : createDefaultGUITemplate();

        // Abort before touching the DOM if the effect was already cleaned up
        // (e.g. Strict Mode ran cleanup synchronously before Promise.all resolved).
        if (cancelled) return;

        const editor = await initAgentGrapesJS(wrapper, projectData, () => cancelled);
        if (!editor) return;

        if (cancelled) {
          editor.destroy();
          return;
        }
        editorRef.current = editor;

        // Register custom components and blocks synchronously after init.
        // GrapesJS loads projectData inside a setTimeout (loadOnStart), so
        // all registrations here complete before the data is applied.
        registerAllComponents(editor);

        editor.on('load', () => {
          removeUnwantedBlocks(editor);
        });
      } catch (err) {
        if (!cancelled) console.error('[AgentGUIEditor] Failed to initialize:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
      // Remove wrapper so a late-resolving IIFE cannot call grapesjs.init()
      // on a container that now belongs to the next mount.
      wrapper.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!editorRef.current) return;
    const data = editorRef.current.getProjectData();
    onSave(normalizeToGrapesJSProjectData(data));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '620px',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        overflow: 'hidden',
        marginTop: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'var(--muted)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600 }}>GUI Editor</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Save and Exit
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}

async function initAgentGrapesJS(
  container: HTMLDivElement,
  projectData: GrapesJSProjectData,
  isCancelled?: () => boolean,
): Promise<Editor | null> {
  const [
    { default: grapesjs },
    { default: gjsPresetWebpage },
    { default: gjsStyleBg },
    { default: gjsBlocksBasic },
  ] = await Promise.all([
    import('grapesjs'),
    import('grapesjs-preset-webpage'),
    import('grapesjs-style-bg'),
    // @ts-ignore
    import('grapesjs-blocks-basic'),
  ]);
  await import('grapesjs/dist/css/grapes.min.css');

  // Check after all async imports complete — cleanup may have run while waiting.
  if (isCancelled?.()) return null;

  return grapesjs.init({
    container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    // Pass saved (or default) data directly — GrapesJS loads it in loadOnStart
    // before the 'load' event fires, so custom components are registered first.
    projectData,
    storageManager: false,
    plugins: [gjsPresetWebpage as any, gjsStyleBg as any, gjsBlocksBasic as any],
    pluginsOpts: {
      'grapesjs-preset-webpage': {
        modalImportTitle: 'Import Template',
        modalImportLabel:
          '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
        modalImportContent: (ed: Editor) =>
          ed.getHtml() + '<style>' + ed.getCss() + '</style>',
        filestackOpts: null,
        aviaryOpts: false,
        blocksBasicOpts: {
          blocks: ['column1', 'column2', 'column3', 'text', 'image'],
          flexGrid: true,
        },
        customStyleManager: [
          {
            name: 'Position',
            open: true,
            buildProps: ['position', 'top', 'right', 'bottom', 'left', 'z-index'],
          },
          {
            name: 'Dimension',
            open: false,
            buildProps: ['width', 'height', 'max-width', 'min-height', 'padding', 'margin'],
          },
          {
            name: 'Typography',
            open: false,
            buildProps: [
              'font-size',
              'font-weight',
              'font-family',
              'color',
              'line-height',
              'text-align',
            ],
          },
          {
            name: 'Decorations',
            open: false,
            buildProps: ['background-color', 'border-radius', 'border', 'box-shadow'],
          },
        ],
      },
      'grapesjs-style-bg': {},
      'grapesjs-blocks-basic': {
        blocks: ['column1', 'column2', 'column3', 'text', 'image'],
        flexGrid: true,
      },
    },
    showOffsets: true,
    canvas: { styles: [], scripts: [] },
  });
}

function removeUnwantedBlocks(editor: Editor) {
  const bm = editor.BlockManager;
  [
    'link-block',
    'quote',
    'video',
    'map',
    'sect100',
    'sect50',
    'sect30',
    'sect37',
    'divider',
    'text-sect',
    'form',
    'input',
    'textarea',
    'select',
    'button',
    'label',
    'checkbox',
    'radio',
  ].forEach((id) => {
    try {
      bm.remove(id);
    } catch {}
  });
}
