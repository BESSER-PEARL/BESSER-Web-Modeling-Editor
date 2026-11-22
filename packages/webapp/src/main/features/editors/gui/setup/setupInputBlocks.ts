import type { Editor } from 'grapesjs';
import { getClassOptions, getClassMetadata } from '../diagram-helpers';

/**
 * Setup Input blocks for the GUI editor palette.
 * Registers all BESSER GUI InputFieldType variants plus Form and Alert
 * as GrapesJS blocks in the "Inputs" category.
 *
 * Each block stores a `data-gui-type` attribute that the Python backend
 * reads to map the element to the correct BESSER InputFieldType (or Alert).
 */
export function setupInputBlocks(editor: Editor): void {
  const bm = editor.BlockManager;
  const domc = editor.DomComponents;

  // ─── Register GrapesJS component types ──────────────────────────────────────

  registerWrappedInputType(domc, 'gui-input-text', 'Text', 'text', []);
  registerWrappedInputType(domc, 'gui-input-number', 'Number', 'number', [
    { type: 'number', label: 'Min', name: 'input-min', changeProp: 1 },
    { type: 'number', label: 'Max', name: 'input-max', changeProp: 1 },
    { type: 'number', label: 'Step', name: 'input-step', changeProp: 1 },
  ]);
  registerWrappedInputType(domc, 'gui-input-password', 'Password', 'password', []);
  registerWrappedInputType(domc, 'gui-input-email', 'Email', 'email', []);
  registerWrappedInputType(domc, 'gui-input-search', 'Search', 'search', []);
  registerWrappedInputType(domc, 'gui-input-url', 'URL', 'url', []);
  registerWrappedInputType(domc, 'gui-input-tel', 'Phone', 'tel', []);
  registerWrappedInputType(domc, 'gui-input-date', 'Date', 'date', []);
  registerWrappedInputType(domc, 'gui-input-time', 'Time', 'time', []);
  registerWrappedInputType(domc, 'gui-input-datetime', 'Date & Time', 'datetime-local', []);

  registerSliderType(domc);
  registerSpinnerType(domc);
  registerDropdownType(domc);
  registerToggleType(domc);
  registerCheckboxType(domc);
  registerRadioGroupType(domc);
  registerCheckboxGroupType(domc);
  registerMultiSelectType(domc);
  registerTextareaType(domc);
  registerRatingType(domc);
  registerColorPickerType(domc);
  registerFileUploadType(domc);
  registerGuiFormType(domc);
  registerAlertType(domc);

  // ─── Register blocks in the "Inputs" category ────────────────────────────────

  bm.add('gui-input-text', {
    label: 'Text',
    category: 'Inputs',
    content: { type: 'gui-input-text' },
    media: iconInput(`<rect x="3" y="9" width="18" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-number', {
    label: 'Number',
    category: 'Inputs',
    content: { type: 'gui-input-number' },
    media: iconInput(`<rect x="3" y="9" width="18" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><text x="6" y="14" font-size="6" fill="currentColor">123</text>`),
  });

  bm.add('gui-input-slider', {
    label: 'Slider',
    category: 'Inputs',
    content: { type: 'gui-input-slider' },
    media: iconInput(`<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="12" r="3" fill="currentColor"/>`),
  });

  bm.add('gui-input-spinner', {
    label: 'Spinner',
    category: 'Inputs',
    content: { type: 'gui-input-spinner' },
    media: iconInput(`<rect x="3" y="9" width="14" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="19,9 21,12 19,15" fill="none" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-dropdown', {
    label: 'Dropdown',
    category: 'Inputs',
    content: { type: 'gui-input-dropdown' },
    media: iconInput(`<rect x="3" y="9" width="18" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="15,11 17,13 19,11" fill="none" stroke="currentColor" stroke-width="1.5"/>`),
  });

  bm.add('gui-input-toggle', {
    label: 'Toggle',
    category: 'Inputs',
    content: { type: 'gui-input-toggle' },
    media: iconInput(`<rect x="3" y="9" width="18" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="12" r="2.5" fill="currentColor"/>`),
  });

  bm.add('gui-input-checkbox', {
    label: 'Checkbox',
    category: 'Inputs',
    content: { type: 'gui-input-checkbox' },
    media: iconInput(`<rect x="5" y="8" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="7,12 9,14 13,10" fill="none" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-radio', {
    label: 'Radio Group',
    category: 'Inputs',
    content: { type: 'gui-input-radio' },
    media: iconInput(`<circle cx="8" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="10" r="1" fill="currentColor"/><line x1="13" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/><line x1="13" y1="16" x2="21" y2="16" stroke="currentColor" stroke-width="1.5"/>`),
  });

  bm.add('gui-input-checkbox-group', {
    label: 'Checkbox Group',
    category: 'Inputs',
    content: { type: 'gui-input-checkbox-group' },
    media: iconInput(`<rect x="4" y="8" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><line x1="11" y1="10.5" x2="20" y2="10.5" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="15" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="5,17 7,19 9,15.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="17.5" x2="20" y2="17.5" stroke="currentColor" stroke-width="1.5"/>`),
  });

  bm.add('gui-input-multi-select', {
    label: 'Multi-Select',
    category: 'Inputs',
    content: { type: 'gui-input-multi-select' },
    media: iconInput(`<rect x="3" y="9" width="18" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="15,11 17,13 19,11" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.5"/>`),
  });

  bm.add('gui-input-textarea', {
    label: 'Text Area',
    category: 'Inputs',
    content: { type: 'gui-input-textarea' },
    media: iconInput(`<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="1.5"/>`),
  });

  bm.add('gui-input-date', {
    label: 'Date',
    category: 'Inputs',
    content: { type: 'gui-input-date' },
    media: iconInput(`<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" stroke-width="2"/><line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-time', {
    label: 'Time',
    category: 'Inputs',
    content: { type: 'gui-input-time' },
    media: iconInput(`<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="12,7 12,12 15,15" fill="none" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-datetime', {
    label: 'Date & Time',
    category: 'Inputs',
    content: { type: 'gui-input-datetime' },
    media: iconInput(`<rect x="3" y="5" width="12" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="18,14 18,16 20,17" fill="none" stroke="currentColor" stroke-width="1.5"/>`),
  });

  bm.add('gui-input-rating', {
    label: 'Rating',
    category: 'Inputs',
    content: { type: 'gui-input-rating' },
    media: iconInput(`<polygon points="12,4 14.5,9 20,9.5 16,13.5 17.2,19 12,16.2 6.8,19 8,13.5 4,9.5 9.5,9" fill="none" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-color', {
    label: 'Color Picker',
    category: 'Inputs',
    content: { type: 'gui-input-color' },
    media: iconInput(`<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`),
  });

  bm.add('gui-input-file', {
    label: 'File Upload',
    category: 'Inputs',
    content: { type: 'gui-input-file' },
    media: iconInput(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><polyline points="9,15 12,12 15,15" fill="none" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-input-password', {
    label: 'Password',
    category: 'Inputs',
    content: { type: 'gui-input-password' },
    media: iconInput(`<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2"/>`),
  });

  bm.add('gui-form', {
    label: 'Form',
    category: 'Inputs',
    content: { type: 'gui-form' },
    media: iconInput(`<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="13" x2="17" y2="13" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="16" width="8" height="2.5" rx="1" fill="currentColor"/>`),
  });

  // Field dropdown options follow the parent form's bound class — refresh on
  // every selection so late drops and class-diagram edits are reflected.
  editor.on('component:selected', (component: any) => {
    component?.__refreshFieldNameOptions?.();
  });

  bm.add('gui-alert', {
    label: 'Alert',
    category: 'Inputs',
    content: { type: 'gui-alert' },
    media: iconInput(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="16" r="1" fill="currentColor"/>`),
  });
}

// ─── Helper: build an SVG icon string ─────────────────────────────────────────

function iconInput(innerSvg: string): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24">${innerSvg}</svg>`;
}


// ─── Field-name binding (attribute dropdown fed by the parent form) ──────────

/**
 * Turn a component's free-text `field-name` trait into a select of the parent
 * form's bound-class attributes. Falls back to free text when the input is
 * outside a form or the form has no bound class yet. Re-runs via
 * `__refreshFieldNameOptions` on selection and on form-binding changes.
 */
function setupFieldNameBinding(model: any): void {
  const refresh = () => {
    try {
      let parent = model.parent?.();
      let classId = '';
      while (parent) {
        const attrs = parent.getAttributes?.() || {};
        if (attrs['data-gui-type'] === 'Form') {
          classId = parent.get?.('data-source') || attrs['data-source'] || '';
          break;
        }
        parent = parent.parent?.();
      }
      const traits = model.get('traits');
      const existing = traits?.where?.({ name: 'field-name' })?.[0];
      if (!existing) return;
      const meta = classId ? getClassMetadata(classId) : null;
      const attributes = meta?.attributes || [];
      if (!attributes.length) return;
      const options = [
        { value: '', label: '—' },
        ...attributes.map((a: any) => ({ value: a.name, label: a.name })),
      ];
      const at = traits.indexOf(existing);
      const value = model.get('field-name') || '';
      traits.remove(existing);
      traits.add(
        { type: 'select', label: existing.get('label') || 'Field Name', name: 'field-name', options, value, changeProp: 1 },
        { at },
      );
    } catch {
      /* binding UI is best-effort — never break the editor over it */
    }
  };
  (model as any).__refreshFieldNameOptions = refresh;
  refresh();
}

// ─── Helper: store a trait value as an HTML data-attribute ───────────────────

function storeAttr(model: any, attrName: string, value: string): void {
  const attrs = { ...model.getAttributes() };
  attrs[attrName] = value;
  model.setAttributes(attrs);
}

// ─── Common trait definitions ─────────────────────────────────────────────────

function baseInputTraits(extraTraits: any[] = []): any[] {
  return [
    {
      type: 'text',
      label: 'Label',
      name: 'input-label',
      placeholder: 'Field label',
      changeProp: 1,
    },
    {
      type: 'text',
      label: 'Field Name',
      name: 'field-name',
      placeholder: 'e.g. username',
      changeProp: 1,
    },
    {
      type: 'text',
      label: 'Placeholder',
      name: 'placeholder',
      placeholder: 'Hint text…',
      changeProp: 1,
    },
    {
      type: 'checkbox',
      label: 'Required',
      name: 'required',
      changeProp: 1,
    },
    ...extraTraits,
  ];
}

// ─── Wrapped-input factory (label + <input>) ──────────────────────────────────

function registerWrappedInputType(
  domc: any,
  typeName: string,
  displayName: string,
  htmlInputType: string,
  extraTraits: any[],
): void {
  domc.addType(typeName, {
    isComponent(el: HTMLElement) {
      return el?.getAttribute?.('data-gui-type') === htmlInputType
        && el?.getAttribute?.('data-gui-component') === typeName;
    },
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field',
          'data-gui-type': htmlInputType,
          'data-gui-component': typeName,
        },
        traits: baseInputTraits(extraTraits),
        components: buildWrappedInputHtml(displayName, htmlInputType, ''),
      },
      init(this: any) {
        setupFieldNameBinding(this);
        // Sync current values immediately (handles both fresh placement and load from saved JSON)
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-min', String(this.get('input-min') ?? ''));
        storeAttr(this, 'data-max', String(this.get('input-max') ?? ''));
        storeAttr(this, 'data-step', String(this.get('input-step') ?? ''));
        // Change listeners for subsequent edits
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:placeholder', () => {
          updatePlaceholder(this);
          storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        });
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:input-min', () => storeAttr(this, 'data-min', String(this.get('input-min') ?? '')));
        this.on('change:input-max', () => storeAttr(this, 'data-max', String(this.get('input-max') ?? '')));
        this.on('change:input-step', () => storeAttr(this, 'data-step', String(this.get('input-step') ?? '')));
      },
    },
  });
}

function buildWrappedInputHtml(label: string, type: string, extraStyle: string): string {
  return `
    <label class="ds-label">${label}</label>
    <input class="ds-input" type="${type}" placeholder="Enter ${label.toLowerCase()}" style="${extraStyle}">
  `;
}

function updateLabel(model: any): void {
  const labelEl = model.find('label')[0];
  if (labelEl) {
    const labelComponents = labelEl.components();
    if (labelComponents.length > 0) {
      labelComponents.models[0].set('content', model.get('input-label') || '');
    }
  }
  storeAttr(model, 'data-label', model.get('input-label') || '');
}

function updatePlaceholder(model: any): void {
  const inputEl = model.find('input')[0] || model.find('textarea')[0] || model.find('select')[0];
  if (inputEl) {
    const attrs = inputEl.getAttributes();
    attrs.placeholder = model.get('placeholder') || '';
    inputEl.setAttributes(attrs);
  }
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function registerSliderType(domc: any): void {
  domc.addType('gui-input-slider', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-slider',
          'data-gui-type': 'Slider',
        },
        traits: baseInputTraits([
          { type: 'number', label: 'Min', name: 'input-min', value: 0, changeProp: 1 },
          { type: 'number', label: 'Max', name: 'input-max', value: 100, changeProp: 1 },
          { type: 'number', label: 'Step', name: 'input-step', value: 1, changeProp: 1 },
        ]),
        components: `
          <label class="ds-label">Slider</label>
          <input type="range" min="0" max="100" value="50"
                 style="width:100%;accent-color:var(--ds-primary, #2563eb);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ds-muted, #64748b);">
            <span>0</span><span>100</span>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-min', String(this.get('input-min') ?? 0));
        storeAttr(this, 'data-max', String(this.get('input-max') ?? 100));
        storeAttr(this, 'data-step', String(this.get('input-step') ?? 1));
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:input-min', () => storeAttr(this, 'data-min', String(this.get('input-min') ?? 0)));
        this.on('change:input-max', () => storeAttr(this, 'data-max', String(this.get('input-max') ?? 100)));
        this.on('change:input-step', () => storeAttr(this, 'data-step', String(this.get('input-step') ?? 1)));
      },
    },
  });
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function registerSpinnerType(domc: any): void {
  domc.addType('gui-input-spinner', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-spinner',
          'data-gui-type': 'Spinner',
        },
        traits: baseInputTraits([
          { type: 'number', label: 'Min', name: 'input-min', changeProp: 1 },
          { type: 'number', label: 'Max', name: 'input-max', changeProp: 1 },
          { type: 'number', label: 'Step', name: 'input-step', value: 1, changeProp: 1 },
        ]),
        components: `
          <label class="ds-label">Spinner</label>
          <input type="number" value="0" step="1"
                 class="ds-input">
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-min', String(this.get('input-min') ?? ''));
        storeAttr(this, 'data-max', String(this.get('input-max') ?? ''));
        storeAttr(this, 'data-step', String(this.get('input-step') ?? 1));
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:placeholder', () => {
          updatePlaceholder(this);
          storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        });
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:input-min', () => storeAttr(this, 'data-min', String(this.get('input-min') ?? '')));
        this.on('change:input-max', () => storeAttr(this, 'data-max', String(this.get('input-max') ?? '')));
        this.on('change:input-step', () => storeAttr(this, 'data-step', String(this.get('input-step') ?? 1)));
      },
    },
  });
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function registerDropdownType(domc: any): void {
  domc.addType('gui-input-dropdown', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-dropdown',
          'data-gui-type': 'Dropdown',
        },
        traits: baseInputTraits([
          {
            type: 'text',
            label: 'Options (comma-separated)',
            name: 'select-options',
            placeholder: 'Option A, Option B, Option C',
            changeProp: 1,
          },
        ]),
        components: `
          <label class="ds-label">Dropdown</label>
          <select class="ds-input" style="cursor:pointer;">
            <option value="">Select an option...</option>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
          </select>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-options', this.get('select-options') || '');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:placeholder', () => {
          updatePlaceholder(this);
          storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        });
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:select-options', () => storeAttr(this, 'data-options', this.get('select-options') || ''));
      },
    },
  });
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function registerToggleType(domc: any): void {
  domc.addType('gui-input-toggle', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-toggle',
          'data-gui-type': 'Toggle',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Enable feature', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. isActive', changeProp: 1 },
          { type: 'checkbox', label: 'Default On', name: 'default-checked', changeProp: 1 },
        ],
        components: `
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="position:relative;width:44px;height:24px;flex-shrink:0;">
              <div style="position:absolute;inset:0;background:var(--ds-primary, #2563eb);border-radius:12px;"></div>
              <div style="position:absolute;top:2px;right:2px;width:20px;height:20px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
            </div>
            <label style="font-size:13px;font-weight:600;color:var(--ds-text, #0f172a);cursor:pointer;">Toggle</label>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-default-checked', this.get('default-checked') ? 'true' : 'false');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:default-checked', () => storeAttr(this, 'data-default-checked', this.get('default-checked') ? 'true' : 'false'));
      },
    },
  });
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function registerCheckboxType(domc: any): void {
  domc.addType('gui-input-checkbox', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-checkbox',
          'data-gui-type': 'Checkbox',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Accept terms', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. accepted', changeProp: 1 },
          { type: 'checkbox', label: 'Required', name: 'required', changeProp: 1 },
        ],
        components: `
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" style="width:16px;height:16px;accent-color:var(--ds-primary, #2563eb);cursor:pointer;">
            <label style="font-size:13px;font-weight:600;color:var(--ds-text, #0f172a);cursor:pointer;">Checkbox</label>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
      },
    },
  });
}

// ─── Radio Group ─────────────────────────────────────────────────────────────

function registerRadioGroupType(domc: any): void {
  domc.addType('gui-input-radio', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-radio-group',
          'data-gui-type': 'RadioGroup',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Group label', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. gender', changeProp: 1 },
          {
            type: 'text',
            label: 'Options (comma-separated)',
            name: 'select-options',
            placeholder: 'Option A, Option B',
            changeProp: 1,
          },
          { type: 'checkbox', label: 'Required', name: 'required', changeProp: 1 },
        ],
        components: `
          <label class="ds-label">Radio Group</label>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ds-text, #0f172a);cursor:pointer;">
              <input type="radio" name="radio-group" style="width:14px;height:14px;accent-color:var(--ds-primary, #2563eb);"> Option 1
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ds-text, #0f172a);cursor:pointer;">
              <input type="radio" name="radio-group" style="width:14px;height:14px;accent-color:var(--ds-primary, #2563eb);"> Option 2
            </label>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-options', this.get('select-options') || '');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:select-options', () => storeAttr(this, 'data-options', this.get('select-options') || ''));
      },
    },
  });
}

// ─── Checkbox Group ───────────────────────────────────────────────────────────

function registerCheckboxGroupType(domc: any): void {
  domc.addType('gui-input-checkbox-group', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-checkbox-group',
          'data-gui-type': 'CheckboxGroup',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Group label', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. interests', changeProp: 1 },
          {
            type: 'text',
            label: 'Options (comma-separated)',
            name: 'select-options',
            placeholder: 'Music, Sports, Art',
            changeProp: 1,
          },
        ],
        components: `
          <label class="ds-label">Checkbox Group</label>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ds-text, #0f172a);cursor:pointer;">
              <input type="checkbox" style="width:14px;height:14px;accent-color:var(--ds-primary, #2563eb);"> Option 1
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ds-text, #0f172a);cursor:pointer;">
              <input type="checkbox" style="width:14px;height:14px;accent-color:var(--ds-primary, #2563eb);" checked> Option 2
            </label>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-options', this.get('select-options') || '');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:select-options', () => storeAttr(this, 'data-options', this.get('select-options') || ''));
      },
    },
  });
}

// ─── Multi-Select ─────────────────────────────────────────────────────────────

function registerMultiSelectType(domc: any): void {
  domc.addType('gui-input-multi-select', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-multi-select',
          'data-gui-type': 'MultiSelect',
        },
        traits: baseInputTraits([
          {
            type: 'text',
            label: 'Options (comma-separated)',
            name: 'select-options',
            placeholder: 'Option A, Option B, Option C',
            changeProp: 1,
          },
        ]),
        components: `
          <label class="ds-label">Multi-Select</label>
          <select multiple class="ds-input" style="min-height:80px;">
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </select>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-options', this.get('select-options') || '');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:placeholder', () => {
          updatePlaceholder(this);
          storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        });
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:select-options', () => storeAttr(this, 'data-options', this.get('select-options') || ''));
      },
    },
  });
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

function registerTextareaType(domc: any): void {
  domc.addType('gui-input-textarea', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-textarea',
          'data-gui-type': 'TextArea',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Field label', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. description', changeProp: 1 },
          { type: 'text', label: 'Placeholder', name: 'placeholder', placeholder: 'Enter text…', changeProp: 1 },
          { type: 'number', label: 'Rows', name: 'textarea-rows', value: 4, changeProp: 1 },
          { type: 'number', label: 'Max Length', name: 'max-length', changeProp: 1 },
          { type: 'checkbox', label: 'Required', name: 'required', changeProp: 1 },
        ],
        components: `
          <label class="ds-label">Text Area</label>
          <textarea rows="4" placeholder="Enter text here..."
                    class="ds-input" style="resize:vertical;"></textarea>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false');
        storeAttr(this, 'data-rows', String(this.get('textarea-rows') || 4));
        storeAttr(this, 'data-max-length', String(this.get('max-length') ?? ''));
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:placeholder', () => {
          updatePlaceholder(this);
          storeAttr(this, 'data-placeholder', this.get('placeholder') || '');
        });
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:required', () => storeAttr(this, 'data-required', this.get('required') ? 'true' : 'false'));
        this.on('change:textarea-rows', () => storeAttr(this, 'data-rows', String(this.get('textarea-rows') || 4)));
        this.on('change:max-length', () => storeAttr(this, 'data-max-length', String(this.get('max-length') ?? '')));
      },
    },
  });
}

// ─── Rating ───────────────────────────────────────────────────────────────────

function registerRatingType(domc: any): void {
  domc.addType('gui-input-rating', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-rating',
          'data-gui-type': 'Rating',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Rating', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. score', changeProp: 1 },
          { type: 'number', label: 'Max Stars', name: 'max-stars', value: 5, changeProp: 1 },
        ],
        components: `
          <label class="ds-label">Rating</label>
          <div style="display:flex;gap:4px;font-size:24px;color:#f59e0b;cursor:pointer;">
            <span>★</span><span>★</span><span>★</span><span style="color:var(--ds-border, #e2e8f0);">★</span><span style="color:var(--ds-border, #e2e8f0);">★</span>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-max-stars', String(this.get('max-stars') ?? 5));
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:max-stars', () => storeAttr(this, 'data-max-stars', String(this.get('max-stars') ?? 5)));
      },
    },
  });
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

function registerColorPickerType(domc: any): void {
  domc.addType('gui-input-color', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-color-picker',
          'data-gui-type': 'Color',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Pick color', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. themeColor', changeProp: 1 },
        ],
        components: `
          <label class="ds-label">Color Picker</label>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="color" value="#6b47dc"
                   style="width:44px;height:36px;border:1px solid var(--ds-border, #e2e8f0);border-radius:6px;cursor:pointer;padding:2px;">
            <span style="font-size:13px;color:var(--ds-muted, #64748b);">#6b47dc</span>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
      },
    },
  });
}

// ─── File Upload ──────────────────────────────────────────────────────────────

function registerFileUploadType(domc: any): void {
  domc.addType('gui-input-file', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-input-field ds-field gui-file-upload',
          'data-gui-type': 'File',
        },
        traits: [
          { type: 'text', label: 'Label', name: 'input-label', placeholder: 'Upload file', changeProp: 1 },
          { type: 'text', label: 'Field Name', name: 'field-name', placeholder: 'e.g. attachment', changeProp: 1 },
          { type: 'text', label: 'Accepted Types', name: 'accept-types', placeholder: '.pdf,.jpg,.png', changeProp: 1 },
          { type: 'checkbox', label: 'Multiple Files', name: 'multiple-files', changeProp: 1 },
        ],
        components: `
          <label class="ds-label">File Upload</label>
          <div style="border:2px dashed var(--ds-border, #e2e8f0);border-radius:8px;padding:20px;text-align:center;background:var(--ds-background, #f8fafc);cursor:pointer;">
            <div style="font-size:28px;color:#9ca3af;margin-bottom:6px;">📁</div>
            <div style="font-size:13px;color:var(--ds-muted, #64748b);">Click to upload or drag & drop</div>
          </div>
        `,
      },
      init(this: any) {
        setupFieldNameBinding(this);
        storeAttr(this, 'data-label', this.get('input-label') || '');
        storeAttr(this, 'data-field-name', this.get('field-name') || '');
        storeAttr(this, 'data-accept', this.get('accept-types') || '');
        storeAttr(this, 'data-multiple', this.get('multiple-files') ? 'true' : 'false');
        this.on('change:input-label', () => updateLabel(this));
        this.on('change:field-name', () => storeAttr(this, 'data-field-name', this.get('field-name') || ''));
        this.on('change:accept-types', () => storeAttr(this, 'data-accept', this.get('accept-types') || ''));
        this.on('change:multiple-files', () => storeAttr(this, 'data-multiple', this.get('multiple-files') ? 'true' : 'false'));
      },
    },
  });
}

// ─── Form ──────────────────────────────────────────────────────────────────────

function registerGuiFormType(domc: any): void {
  domc.addType('gui-form', {
    model: {
      defaults: {
        tagName: 'form',
        draggable: true,
        droppable: true,
        attributes: {
          class: 'gui-form ds-card',
          'data-gui-type': 'Form',
          method: 'POST',
        },
        style: {
          'min-height': '120px',
        },
        traits: [
          {
            type: 'select',
            label: 'Bound class',
            name: 'data-source',
            options: [],
            changeProp: 1,
          },
          { type: 'text', label: 'Form Name', name: 'form-name', placeholder: 'e.g. createUser', changeProp: 1 },
          {
            type: 'select',
            label: 'Method',
            name: 'form-method',
            options: [
              { value: 'POST', label: 'POST' },
              { value: 'GET', label: 'GET' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
            ],
            value: 'POST',
            changeProp: 1,
          },
          {
            type: 'select',
            label: 'Action',
            name: 'form-action',
            options: [
              { value: 'create', label: 'Create' },
              { value: 'update', label: 'Update' },
              { value: 'custom', label: 'Custom' },
            ],
            value: 'create',
            changeProp: 1,
          },
        ],
        components: `
          <div style="font-size:12px;color:#9ca3af;text-align:center;padding:10px;border:2px dashed var(--ds-border, #e2e8f0);border-radius:6px;">
            Drag input fields here
          </div>
        `,
      },
      init(this: any) {
        const dsTrait = this.get('traits')?.where?.({ name: 'data-source' })?.[0];
        if (dsTrait) dsTrait.set('options', [{ value: '', label: '—' }, ...getClassOptions()]);
        const storedClass = this.getAttributes()['data-source'];
        if (storedClass && !this.get('data-source')) {
          this.set('data-source', storedClass, { silent: true });
        }
        this.on('change:data-source', () => {
          const attrs = { ...this.getAttributes() };
          attrs['data-source'] = this.get('data-source') || '';
          this.setAttributes(attrs);
          const walk = (comp: any) =>
            comp.components?.()?.forEach((c: any) => {
              c.__refreshFieldNameOptions?.();
              walk(c);
            });
          walk(this);
        });
        this.on('change:form-method', () => {
          const attrs = { ...this.getAttributes() };
          attrs.method = this.get('form-method') || 'POST';
          this.setAttributes(attrs);
        });
        this.on('change:form-name', () => {
          const attrs = { ...this.getAttributes() };
          attrs['data-form-name'] = this.get('form-name') || '';
          this.setAttributes(attrs);
        });
        this.on('change:form-action', () => {
          const attrs = { ...this.getAttributes() };
          attrs['data-form-action'] = this.get('form-action') || 'create';
          this.setAttributes(attrs);
        });
      },
    },
    view: {
      onRender({ el }: any) {
        el.style.minHeight = '80px';
      },
    },
  });
}

// ─── Alert ────────────────────────────────────────────────────────────────────

const ALERT_SEVERITY_STYLES: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  Info: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', icon: 'ℹ️' },
  Success: { bg: '#f0fdf4', border: '#86efac', color: '#15803d', icon: '✅' },
  Warning: { bg: '#fffbeb', border: '#fcd34d', color: '#b45309', icon: '⚠️' },
  Error: { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', icon: '❌' },
};

function buildAlertHtml(severity: string, title: string, content: string): string {
  const s = ALERT_SEVERITY_STYLES[severity] || ALERT_SEVERITY_STYLES['Info'];
  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 16px;background:${s.bg};border:1px solid ${s.border};border-radius:8px;">
      <span style="font-size:18px;flex-shrink:0;margin-top:1px;">${s.icon}</span>
      <div>
        ${title ? `<div style="font-weight:700;font-size:14px;color:${s.color};margin-bottom:2px;">${title}</div>` : ''}
        <div style="font-size:13px;color:${s.color};">${content}</div>
      </div>
    </div>
  `;
}

function registerAlertType(domc: any): void {
  domc.addType('gui-alert', {
    model: {
      defaults: {
        tagName: 'div',
        draggable: true,
        droppable: false,
        attributes: {
          class: 'gui-alert ds-field',
          'data-gui-type': 'Alert',
          'data-severity': 'Info',
        },
        'alert-severity': 'Info',
        'alert-title': '',
        'alert-content': 'This is an informational message.',
        'alert-dismissible': false,
        traits: [
          {
            type: 'select',
            label: 'Severity',
            name: 'alert-severity',
            options: [
              { value: 'Info', label: 'Info' },
              { value: 'Success', label: 'Success' },
              { value: 'Warning', label: 'Warning' },
              { value: 'Error', label: 'Error' },
            ],
            value: 'Info',
            changeProp: 1,
          },
          { type: 'text', label: 'Title', name: 'alert-title', placeholder: 'Optional heading', changeProp: 1 },
          { type: 'text', label: 'Message', name: 'alert-content', placeholder: 'Alert message', changeProp: 1 },
          { type: 'checkbox', label: 'Dismissible', name: 'alert-dismissible', changeProp: 1 },
        ],
        components: buildAlertHtml('Info', '', 'This is an informational message.'),
      },
      init(this: any) {
        const rebuild = () => {
          const severity = this.get('alert-severity') || 'Info';
          const title = this.get('alert-title') || '';
          const content = this.get('alert-content') || '';
          const dismissible = this.get('alert-dismissible') || false;
          this.components(buildAlertHtml(severity, title, content));
          const attrs = { ...this.getAttributes() };
          attrs['data-severity'] = severity;
          attrs['data-title'] = title;
          attrs['data-content'] = content;
          attrs['data-dismissible'] = dismissible ? 'true' : 'false';
          this.setAttributes(attrs);
        };
        this.on('change:alert-severity change:alert-title change:alert-content change:alert-dismissible', rebuild);
      },
    },
  });
}
