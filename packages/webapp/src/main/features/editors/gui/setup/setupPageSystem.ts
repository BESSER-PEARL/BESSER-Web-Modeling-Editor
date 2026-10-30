import type { Editor } from 'grapesjs';
import { globalConfirm } from '../../../../shared/services/confirm/globalConfirm';
import {
  GUI_PERSONALIZE_EVENT,
  GUI_VARIANTS_REQUEST_EVENT,
  GUI_VARIANTS_STATE_EVENT,
  GUI_VARIANT_SELECT_EVENT,
} from '../../../../shared/constants/gui-personalize-event';
import { isReadAloudVariant, setPageReadAloud, setupGuiReadAloudControls } from './guiReadAloudControls';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { apiClient, ApiError } from '../../../../shared/api/api-client';
import { captureAnalyticsEvent } from '../../../../shared/services/analytics/lazy-analytics';
import {
  aggregateGuiPresentation,
  aggregateGuiContent,
  guiReadAloudEnabled,
  applyGuiPresentation,
  captureGuiFontSizes,
  guiProfileOptions,
  type GuiProfileOption,
} from '../../../../shared/utils/gui-personalization';
import { mergeSingletonBoxes, reinjectHiddenContainers } from '../../../../shared/utils/user-profile-graph';

// Track initialization per editor instance
let pagesListRaf: number | null = null;

import type { PageSnapshot, PageVariant } from '../../../../shared/utils/buildWebAppVersions';

const VARIANT_STORAGE_FIELD = 'besserPageVariants';
const ACTIVE_VARIANT_FIELD = 'besserActiveVariantId';
const BASE_SNAPSHOT_FIELD = 'besserBaseSnapshot';

const slugify = (value: string): string =>
  (value || 'page')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';

// Escape user-controlled strings (page/profile names) before innerHTML interpolation.
const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getPageVariants = (page: any): PageVariant[] => {
  const raw = page?.get?.(VARIANT_STORAGE_FIELD);
  if (!raw || typeof raw !== 'string') return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const setPageVariants = (page: any, variants: PageVariant[]) => {
  if (!page?.set) return;
  page.set(VARIANT_STORAGE_FIELD, JSON.stringify(variants));
};

const getActiveVariantId = (page: any): string | null => {
  return page?.get?.(ACTIVE_VARIANT_FIELD) || null;
};

const setActiveVariantId = (page: any, variantId: string | null) => {
  if (!page?.set) return;
  page.set(ACTIVE_VARIANT_FIELD, variantId);
};

const getBaseSnapshot = (page: any): PageSnapshot | null => {
  const raw = page?.get?.(BASE_SNAPSHOT_FIELD);
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setBaseSnapshot = (page: any, snapshot: PageSnapshot) => {
  if (!page?.set) return;
  page.set(BASE_SNAPSHOT_FIELD, JSON.stringify(snapshot));
};

// --- Snapshot capture / restore -------------------------------------------
// The personalization UX keeps ONE GrapesJS page and swaps its content in and
// out per profile. Each profile (and the implicit "Base") owns an independent
// snapshot of the page's component tree + its page-scoped CSS rules. Because
// only one snapshot is ever mounted at a time, "the page's current CSS rules"
// always equals "the active variant's CSS", so we can swap both atomically and
// no component-id remapping is required.

// Walk a live GrapesJS component and all of its descendants.
const collectLiveComponents = (root: any): any[] => {
  const out: any[] = [];
  const walk = (c: any) => {
    if (!c) return;
    out.push(c);
    const kids = c.components?.();
    kids?.forEach?.((k: any) => walk(k));
  };
  walk(root);
  return out;
};

// Resolve the CSS rules that style the page's CURRENT live content. Uses
// GrapesJS's own component->rules resolver (getComponentRules) for every
// component in the tree — reliable across id/class selectors and independent of
// whether rules carry a pageId — plus any rules explicitly tagged with this
// page's id. This is what makes per-variant CSS truly isolated: a pageId-only
// or selector-string filter missed the unscoped Base rules, so personalized
// styles leaked into Base.
const getLivePageRules = (editor: Editor, page: any): any[] => {
  const seen = new Set<any>();
  const rules: any[] = [];
  const main = page?.getMainComponent?.();
  if (main) {
    collectLiveComponents(main).forEach((comp: any) => {
      let compRules: any[] = [];
      try {
        compRules = editor.Css.getComponentRules(comp) || [];
      } catch {
        compRules = [];
      }
      compRules.forEach((r: any) => {
        if (!seen.has(r)) {
          seen.add(r);
          rules.push(r);
        }
      });
    });
  }
  const pageId = page?.getId?.();
  if (pageId) {
    try {
      editor.Css.getAll().forEach((r: any) => {
        let json: any;
        try {
          json = r.toJSON();
        } catch {
          return;
        }
        if (json?.pageId === pageId && !seen.has(r)) {
          seen.add(r);
          rules.push(r);
        }
      });
    } catch {
      /* ignore */
    }
  }
  return rules;
};

const captureSnapshot = (editor: Editor, page: any): PageSnapshot => {
  const main = page?.getMainComponent?.();
  const components = main ? JSON.parse(JSON.stringify(main.components().toJSON())) : [];
  const css = getLivePageRules(editor, page).map((rule: any) =>
    JSON.parse(JSON.stringify(rule.toJSON())),
  );
  const fontSizes: Record<string, number> = {};
  collectLiveComponents(main).forEach((component: any) => {
    const element = component.getEl?.();
    const id = component.getId?.();
    if (element && id) Object.assign(fontSizes, captureGuiFontSizes(element, id, component.get?.('type') === 'table'));
  });
  return { components, css, ...(Object.keys(fontSizes).length ? { fontSizes } : {}) };
};

const applySnapshot = (editor: Editor, page: any, snapshot: PageSnapshot) => {
  const main = page?.getMainComponent?.();
  // Remove every rule styling the CURRENT (outgoing) content before swapping, so
  // the incoming snapshot's rules can't merge into a stale rule and so the
  // outgoing variant's styles don't linger on the next one (the Base leak).
  getLivePageRules(editor, page).forEach((rule: any) => {
    try {
      editor.Css.remove(rule);
    } catch (err) {
      console.warn('[Personalization] Failed to remove CSS rule:', err);
    }
  });
  // Swap the component tree.
  if (main) {
    main.components().reset(snapshot?.components || []);
  }
  // Re-add the incoming snapshot's rules. Add per-rule (this reliably applies
  // the styles); addCollection() dropped them in this GrapesJS build.
  (snapshot?.css || []).forEach((ruleJson: any) => {
    try {
      editor.Css.getAll().add(ruleJson);
    } catch (err) {
      console.warn('[Personalization] Failed to add CSS rule:', err);
    }
  });
};

// Persist the live canvas into whichever variant/base is currently active.
const saveActiveLive = (editor: Editor, page: any) => {
  const snapshot = captureSnapshot(editor, page);
  const activeId = getActiveVariantId(page);
  if (activeId == null) {
    setBaseSnapshot(page, snapshot);
    return;
  }
  const variants = getPageVariants(page);
  const idx = variants.findIndex((v) => v.id === activeId);
  if (idx >= 0) {
    variants[idx] = { ...variants[idx], snapshot };
    setPageVariants(page, variants);
  } else {
    // Active id points at nothing (stale) — treat current content as base.
    setBaseSnapshot(page, snapshot);
  }
};

// Switch the page to a different variant (null = Base): save outgoing, load incoming.
const switchVariant = (editor: Editor, page: any, targetId: string | null) => {
  const activeId = getActiveVariantId(page);
  if (targetId === activeId) return;
  saveActiveLive(editor, page);
  const nextSnapshot =
    targetId == null
      ? getBaseSnapshot(page)
      : (getPageVariants(page).find((v) => v.id === targetId)?.snapshot ?? null);
  if (nextSnapshot) {
    applySnapshot(editor, page, nextSnapshot);
  }
  setActiveVariantId(page, targetId);
};

const getPageRoute = (page: any): string => {
  try {
    const name = page?.getName?.() || 'page';
    return page?.get?.('route_path') || '/' + slugify(name);
  } catch {
    // Never let route computation blank out the whole pages list.
    return '/page';
  }
};

const createUniquePageId = (baseName: string): string => `${slugify(baseName)}-${Date.now()}`;

type ProfileOption = GuiProfileOption;

const getAvailableProfiles = (): ProfileOption[] => {
  try {
    const project = ProjectStorageRepository.getCurrentProject();
    if (!project) {
      return [];
    }

    const userDiagrams = project.diagrams?.UserDiagram || [];
    return guiProfileOptions(userDiagrams as Parameters<typeof guiProfileOptions>[0]);
  } catch (err) {
    console.warn('[Personalization] Error fetching profiles:', err);
    return [];
  }
};

// Fire a GrapesJS notification (success/error/info) — the editor's standard
// way of surfacing async results in this codebase.
const notify = (editor: Editor, type: 'success' | 'error' | 'info', message: string) => {
  try {
    editor.runCommand('notifications:add', { type, message, group: 'Personalization' });
  } catch {
    // Notification plugin not available — non-fatal.
    console.warn(`[Personalization] ${type}: ${message}`);
  }
};

// Show a blocking modal with an indeterminate progress bar while a long task
// runs. Returns a function that closes it.
const openLoadingModal = (editor: Editor, title: string, message: string): (() => void) => {
  const modal = editor.Modal;
  modal.setTitle(title);
  modal.setContent(`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 340px; padding: 4px 0 8px;">
      <p style="margin: 0 0 14px; color: #444; line-height: 1.5;">${message}</p>
      <div style="position: relative; height: 8px; border-radius: 999px; background: #e8e8e8; overflow: hidden;">
        <div style="position: absolute; top: 0; bottom: 0; left: -40%; width: 40%; border-radius: 999px; background: #2563eb; animation: gjsPersonalizeIndet 1.2s ease-in-out infinite;"></div>
      </div>
      <p style="margin: 12px 0 0; color: #888; font-size: 12px;">This can take up to a minute. Please don't close the editor.</p>
      <style>
        @keyframes gjsPersonalizeIndet {
          0% { left: -40%; }
          50% { left: 40%; }
          100% { left: 100%; }
        }
      </style>
    </div>
  `);
  modal.open();
  return () => {
    try {
      modal.close();
    } catch {
      /* modal already closed */
    }
  };
};

// Call the backend to LLM-personalize the current page content for a profile.
// Returns a new PageSnapshot ({components, css}) or throws on failure.
const personalizeSnapshotWithAI = async (
  editor: Editor,
  page: any,
  profile: ProfileOption,
  baseline: PageSnapshot = captureSnapshot(editor, page),
  options?: { adaptFromProfile: boolean; guiPersonalization?: { presentation: ReturnType<typeof aggregateGuiPresentation>; content?: ReturnType<typeof aggregateGuiContent> } },
): Promise<PageSnapshot> => {
  const response = await apiClient.post<{ guiPage?: PageSnapshot }>(
    '/personalize-gui-page',
    {
      guiPage: baseline,
      pageName: page?.getName?.() || 'page',
      userProfileModel: reinjectHiddenContainers(mergeSingletonBoxes(profile.model)),
      ...options,
    },
    // LLM calls are slow; mirror the long timeout used by other transforms.
    { timeout: 600_000 },
  );

  const result = response?.guiPage;
  if (!result || !Array.isArray(result.components)) {
    throw new Error('Personalization service returned an invalid page.');
  }
  const pageId = page?.getId?.();
  return {
    components: result.components,
    // Keep variant CSS scoped to this page regardless of what the LLM echoes back.
    css: Array.isArray(result.css)
      ? result.css.map((rule: any) => (pageId ? { ...rule, pageId } : rule))
      : [],
  };
};

const openProfilePickerModal = async (
  editor: Editor,
  options: {
    title: string;
    description: string;
    confirmLabel: string;
    // Pages to choose from. The checklist is only shown for two or more pages.
    pages?: Array<{ id: string; name: string }>;
    onConfirm: (
      profile: ProfileOption,
      choices: { personalize: boolean; applyRules: boolean; pageIds: string[] },
    ) => void | Promise<void>;
  },
) => {
  const profiles = getAvailableProfiles();
  if (profiles.length === 0) {
    await globalConfirm({
      title: options.title,
      description: 'No user profiles are available. Create a user profile in the User Diagram first, then try again.',
      confirmLabel: 'OK',
      cancelLabel: 'OK',
    });
    return;
  }

  const modal = editor.Modal;
  const selectId = 'gjs-personalization-profile-select';
  const toggleHtml = `
      <div style="margin-top:14px; font-size:13px; color:#444; line-height:1.4;">
        <strong>Defined GUI personalization rules</strong><br/>
        <span style="color:#777;">The page is adapted with this profile's GUI content, text and styling rules. Content adaptation and text changes use an LLM.</span>
        <span id="gjs-personalization-rules-status" role="status" style="display:block; color:#777; margin-top:4px;"></span>
      </div>`;
  const pageChoices = options.pages && options.pages.length >= 2 ? options.pages : [];
  const pagesHtml = pageChoices.length
    ? `
      <div style="margin-top:14px;">
        <div style="margin-bottom:6px; font-size:12px; font-weight:600; color:#333; text-transform:uppercase; letter-spacing:0.04em;">Pages</div>
        <label style="display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer; font-size:14px; font-weight:600;">
          <input type="checkbox" id="gjs-personalization-pages-all" checked /> All pages
        </label>
        <div style="max-height:150px; overflow-y:auto; border:1px solid #e5e5e5; border-radius:6px; padding:4px 10px;">
          ${pageChoices.map((choice) => `
          <label style="display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer; font-size:14px;">
            <input type="checkbox" class="gjs-personalization-page-check" value="${escapeHtml(choice.id)}" checked /> ${escapeHtml(choice.name)}
          </label>`).join('')}
        </div>
      </div>`
    : '';
  const content = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 320px;">
      <p style="margin: 0 0 12px; color: #444; line-height: 1.5;">${options.description}</p>
      <label for="${selectId}" style="display:block; margin-bottom:8px; font-size:12px; font-weight:600; color:#333; text-transform:uppercase; letter-spacing:0.04em;">User profile</label>
      <select id="${selectId}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:6px; font-size:14px; background:white;">
        ${profiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('')}
      </select>
      ${pagesHtml}
      ${toggleHtml}
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button type="button" id="gjs-personalization-cancel-btn" style="padding:8px 12px; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;">Cancel</button>
        <button type="button" id="gjs-personalization-confirm-btn" style="padding:8px 12px; border:none; border-radius:6px; background:#2563eb; color:#fff; cursor:pointer;">${options.confirmLabel}</button>
      </div>
    </div>
  `;

  modal.setTitle(options.title);
  modal.setContent(content);
  modal.open();

  setTimeout(() => {
    const cancelBtn = document.getElementById('gjs-personalization-cancel-btn');
    const confirmBtn = document.getElementById('gjs-personalization-confirm-btn');
    const select = document.getElementById(selectId) as HTMLSelectElement | null;
    const rulesStatus = document.getElementById('gjs-personalization-rules-status');
    let hasRules = false;
    let hasPages = true;
    const refreshConfirm = () => {
      if (!confirmBtn) return;
      const enabled = hasRules && hasPages;
      (confirmBtn as HTMLButtonElement).disabled = !enabled;
      confirmBtn.style.opacity = enabled ? '1' : '0.5';
    };
    const updateRulesAvailability = () => {
      const profile = profiles.find((profile) => profile.id === select?.value) || profiles[0];
      const count = Object.keys(aggregateGuiPresentation(profile.model)).length + Object.keys(aggregateGuiContent(profile.model)).length + (guiReadAloudEnabled(profile.model) ? 1 : 0);
      hasRules = count > 0;
      if (rulesStatus) rulesStatus.textContent = count > 0
        ? `${count} GUI setting${count === 1 ? '' : 's'} defined for this profile.${guiReadAloudEnabled(profile.model) ? ' Read aloud adds Play controls below text blocks.' : ''}`
        : 'No GUI rules defined for this profile. Add them under GUI \u2192 Presentation, Content, or Modality in the user profile first.';
      refreshConfirm();
    };
    updateRulesAvailability();
    select?.addEventListener('change', updateRulesAvailability);

    // "All pages" toggles every page, and follows the single checkboxes.
    const allPages = document.getElementById('gjs-personalization-pages-all') as HTMLInputElement | null;
    const pageChecks = Array.from(document.querySelectorAll<HTMLInputElement>('.gjs-personalization-page-check'));
    const selectedPageIds = () => pageChecks.filter((check) => check.checked).map((check) => check.value);
    const updatePageSelection = () => {
      const count = selectedPageIds().length;
      if (allPages) {
        allPages.checked = count === pageChecks.length;
        allPages.indeterminate = count > 0 && count < pageChecks.length;
      }
      hasPages = !(pageChecks.length > 0 && count === 0);
      refreshConfirm();
    };
    allPages?.addEventListener('change', () => {
      pageChecks.forEach((check) => { check.checked = allPages.checked; });
      updatePageSelection();
    });
    pageChecks.forEach((check) => check.addEventListener('change', updatePageSelection));

    cancelBtn?.addEventListener('click', () => modal.close());
    confirmBtn?.addEventListener('click', async () => {
      const selectedProfile = profiles.find((profile) => profile.id === select?.value) || profiles[0];
      const personalize = false; // the AI-only adaptation was removed: defined rules are the only option
      const applyRules = true;
      const pageIds = pageChecks.length ? selectedPageIds() : (options.pages ?? []).map((choice) => choice.id);
      modal.close();
      await options.onConfirm(selectedProfile, { personalize, applyRules, pageIds });
    });
  }, 50);
};

// Delete chooser shown when a page has personalization variants: lists Base +
// every variant and lets the user delete a single variant or the whole page.
// Deleting "Base" (or "Delete all") removes the page and every variant with it.
const openPageDeleteModal = (
  editor: Editor,
  page: any,
  handlers: {
    deleteEntirePage: () => void;
    deleteVariant: (variantId: string) => void;
  },
) => {
  const variants = getPageVariants(page);
  const activeId = getActiveVariantId(page);
  const modal = editor.Modal;

  const variantRows = variants
    .map(
      (v) => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 10px; border:1px solid #eee; border-radius:6px; margin-bottom:6px;">
        <span style="font-size:14px; color:#333;">${escapeHtml(v.profileName)}${activeId === v.id ? ' <span style="color:#1d4ed8; font-size:11px; font-weight:600;">(active)</span>' : ''}</span>
        <button type="button" class="gjs-del-variant-btn" data-variant-id="${v.id}" style="padding:6px 10px; border:1px solid #e74c3c; color:#e74c3c; background:#fff; border-radius:6px; cursor:pointer; font-size:12px;">Delete</button>
      </div>`,
    )
    .join('');

  const content = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 360px;">
      <p style="margin:0 0 12px; color:#444; line-height:1.5;">"${escapeHtml(page.getName())}" has personalized variants. Choose what to delete.</p>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 10px; border:1px solid #eee; border-radius:6px; margin-bottom:6px; background:#fafafa;">
        <span style="font-size:14px; color:#333;">Base page <span style="color:#888; font-size:11px;">— deletes the page and all variants</span></span>
        <button type="button" id="gjs-del-base-btn" style="padding:6px 10px; border:none; color:#fff; background:#c0392b; border-radius:6px; cursor:pointer; font-size:12px;">Delete all</button>
      </div>
      ${variantRows}
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button type="button" id="gjs-del-cancel-btn" style="padding:8px 12px; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;">Cancel</button>
      </div>
    </div>
  `;

  modal.setTitle('Delete page or variant');
  modal.setContent(content);
  modal.open();

  setTimeout(() => {
    document.getElementById('gjs-del-cancel-btn')?.addEventListener('click', () => modal.close());
    document.getElementById('gjs-del-base-btn')?.addEventListener('click', () => {
      modal.close();
      handlers.deleteEntirePage();
    });
    document.querySelectorAll('.gjs-del-variant-btn').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const id = (ev.currentTarget as HTMLElement).getAttribute('data-variant-id');
        modal.close();
        if (id) handlers.deleteVariant(id);
      });
    });
  }, 50);
};

/** Create the personalized variant of one page for the chosen profile. */
const createVariantForPage = async (
  editor: Editor,
  page: any,
  profile: ProfileOption,
  { personalize, applyRules }: { personalize: boolean; applyRules: boolean },
) => {
  // Persist any edits in the currently-active variant/base first.
  saveActiveLive(editor, page);

  // Ensure a Base snapshot exists so "Base" can always be restored.
  if (!getBaseSnapshot(page)) {
    setBaseSnapshot(page, captureSnapshot(editor, page));
  }
  const baseSnapshot = getBaseSnapshot(page) ?? captureSnapshot(editor, page);
  const presentation = aggregateGuiPresentation(profile.model);
  const content = aggregateGuiContent(profile.model);
  const simplifyText = applyRules && presentation.languageComplexity === 'simple';
  const translateText = applyRules && !!presentation.language && presentation.language !== 'original';
  const changeSentenceLength = applyRules && !!presentation.sentenceLength && presentation.sentenceLength !== 'original';
  const adaptContent = applyRules && content.adaptContentToUserProfile === true;
  const summarizeContent = applyRules && content.summarizeLongContent === true;
  const personalizeText = simplifyText || translateText || changeSentenceLength || adaptContent || summarizeContent;
  const eventProperties = {
    ai_profile_adaptation: personalize,
    apply_gui_rules: applyRules,
    language: translateText ? presentation.language! : 'original',
    simple_text: simplifyText,
    sentence_length: changeSentenceLength ? presentation.sentenceLength! : 'original',
    adapt_content: adaptContent,
    summarize_content: summarizeContent,
    read_aloud: applyRules && guiReadAloudEnabled(profile.model),
  };
  let usedVisualFallback = false;
  const finishSnapshot = (snapshot: PageSnapshot): PageSnapshot => {
    const result = applyRules
      ? applyGuiPresentation({ ...snapshot, fontSizes: snapshot.fontSizes ?? baseSnapshot.fontSizes }, presentation, page.getId())
      : snapshot;
    const readAloudRequested = applyRules && guiReadAloudEnabled(profile.model);
    const marked = JSON.parse(JSON.stringify(result)) as PageSnapshot;
    const languageTags: Record<string, string> = { english: 'en', french: 'fr', german: 'de', spanish: 'es', portuguese: 'pt', luxembourgish: 'lb', italian: 'it' };
    const languageTag = presentation.language && languageTags[presentation.language];
    const visit = (component: any) => {
      if (!readAloudRequested && component.attributes) delete component.attributes['data-besser-read-aloud'];
      if (readAloudRequested && (component.type === 'text' || ['p', 'blockquote', 'article'].includes(String(component.tagName).toLowerCase()))) {
        component.attributes = { ...component.attributes, 'data-besser-read-aloud': 'true', ...(languageTag ? { lang: languageTag } : {}) };
      }
      if (Array.isArray(component.components)) component.components.forEach(visit);
    };
    marked.components.forEach(visit);
    return marked;
  };

  // Rules start from Base so another profile's styling cannot leak in.
  // When combined with AI, apply explicit settings to the LLM output.
  // On AI failure, offer a copy or rules-only fallback; declining aborts.
  const buildSnapshot = async (): Promise<PageSnapshot | null> => {
    if (!personalize && !personalizeText) return finishSnapshot(applyRules ? baseSnapshot : captureSnapshot(editor, page));

    const closeLoading = openLoadingModal(
      editor,
      !personalize ? translateText && !simplifyText && !changeSentenceLength && !adaptContent && !summarizeContent ? 'Translating page text' : 'Personalizing page text' : 'Personalizing page with AI',
      `Adapting "${page.getName()}" for ${profile.name}…`,
    );
    let snap: PageSnapshot | null = null;
    let failure: string | null = null;
    try {
      snap = await personalizeSnapshotWithAI(
        editor, page, profile, applyRules ? baseSnapshot : captureSnapshot(editor, page),
        { adaptFromProfile: personalize, ...(applyRules ? { guiPersonalization: { presentation, ...(adaptContent || summarizeContent ? { content } : {}) } } : {}) },
      );
    } catch (err) {
      failure =
        err instanceof ApiError
          ? err.message
          : err instanceof DOMException && err.name === 'TimeoutError'
            ? 'The request timed out.'
            : err instanceof Error
              ? err.message
              : 'Unknown error.';
    } finally {
      closeLoading();
    }

    if (snap) {
      notify(editor, 'success', `✓ Personalized "${page.getName()}" for ${profile.name}.`);
      return finishSnapshot(snap);
    }

    // Personalization failed — show the error and ask whether to fall
    // back to a manual copy.
    const makeCopy = await globalConfirm({
      title: 'AI personalization failed',
      description: `${failure ?? 'Something went wrong.'}\n\n${applyRules
        ? personalizeText ? 'Continue with visual rules only? Text personalization failed, so the original wording will be kept.' : 'Continue by applying the defined GUI rules to the Base page?'
        : 'Do you still want to create a copy to manually personalize?'}`,
      confirmLabel: personalizeText ? 'Apply visual rules' : applyRules ? 'Apply rules' : 'Create copy',
      cancelLabel: 'Cancel',
    });
    if (!makeCopy) {
      captureAnalyticsEvent('gui_personalization_variant_cancelled_after_error', eventProperties);
      return null;
    }
    usedVisualFallback = true;
    return finishSnapshot(applyRules ? baseSnapshot : captureSnapshot(editor, page));
  };

  const variants = getPageVariants(page);
  const existing = variants.find((v) => v.profileId === profile.id);

  if (existing) {
    // Re-adding an existing profile replaces its content.
    const confirmed = await globalConfirm({
      title: 'Variant already exists',
      description: personalize
        ? `A variant for "${profile.name}" already exists. Continue to regenerate it with AI? This replaces its current content.`
        : `A personalized variant for "${profile.name}" already exists. Creating it again will replace its current content with the Base page${applyRules ? ' and apply its defined GUI rules' : ''}. Continue?`,
      confirmLabel: personalize ? 'Regenerate with AI' : applyRules ? 'Apply rules' : 'Replace with Base',
      variant: 'danger',
    });
    if (!confirmed) {
      // Leave it untouched — just surface the existing variant.
      switchVariant(editor, page, existing.id);
      updatePagesList(editor);
      return;
    }
    const snapshot = personalize || applyRules ? await buildSnapshot() : baseSnapshot;
    if (!snapshot) {
      // User declined the fallback copy — leave the variant untouched.
      switchVariant(editor, page, existing.id);
      updatePagesList(editor);
      return;
    }
    applySnapshot(editor, page, snapshot);
    const idx = variants.findIndex((v) => v.id === existing.id);
    variants[idx] = { ...existing, snapshot, readAloudEnabled: applyRules && guiReadAloudEnabled(profile.model) };
    setPageVariants(page, variants);
    setActiveVariantId(page, existing.id);
    updatePagesList(editor);
    captureAnalyticsEvent('gui_personalization_variant_replaced', { ...eventProperties, visual_fallback: usedVisualFallback });
    return;
  }

  const snapshot = await buildSnapshot();
  if (!snapshot) {
    // User declined the fallback copy — don't create a variant.
    updatePagesList(editor);
    return;
  }
  // Plain copy already matches the canvas; adapted content must be mounted.
  if (personalize || applyRules) applySnapshot(editor, page, snapshot);

  const newVariant: PageVariant = {
    id: `variant-${profile.id}-${Date.now()}`,
    profileId: profile.id,
    profileName: profile.name,
    readAloudEnabled: applyRules && guiReadAloudEnabled(profile.model),
    snapshot,
  };

  setPageVariants(page, [...variants, newVariant]);
  setActiveVariantId(page, newVariant.id);
  updatePagesList(editor);
  captureAnalyticsEvent('gui_personalization_variant_created', { ...eventProperties, visual_fallback: usedVisualFallback });

};

/**
 * Ask for a profile (and, with two or more pages, which pages), then create the
 * variants. `choosePages` shows the page checklist, which is hidden for one page.
 */
const openAddVariantModal = async (editor: Editor, pages: any[], options?: { choosePages?: boolean }) => {
  const choosePages = !!options?.choosePages && pages.length >= 2;
  captureAnalyticsEvent('gui_personalization_picker_opened', { page_count: pages.length, choose_pages: choosePages });
  await openProfilePickerModal(editor, {
    title: choosePages ? 'Create page variants' : 'Create page variant',
    description: choosePages
      ? 'Choose a user profile and the pages to personalize.'
      : `Choose a user profile to create a personalized variant of "${pages[0]?.getName?.()}".`,
    confirmLabel: choosePages ? 'Create variants' : 'Create variant',
    pages: choosePages ? pages.map((page) => ({ id: page.getId(), name: page.getName() })) : undefined,
    onConfirm: async (profile, { personalize, applyRules, pageIds }) => {
      const targets = choosePages ? pages.filter((page) => pageIds.includes(page.getId())) : pages;
      const original = editor.Pages?.getSelected();
      for (const target of targets) {
        // Show each page first so its live content and fonts can be measured.
        if (targets.length > 1 && editor.Pages?.getSelected() !== target) {
          editor.Pages.select(target);
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        await createVariantForPage(editor, target, profile, { personalize, applyRules });
      }
      if (original && editor.Pages?.getSelected() !== original) editor.Pages.select(original);
    },
  });
};

export function setupPageSystem(editor: Editor) {
  // Check if this specific editor already has the page system initialized
  if ((editor as any).__pageSystemInitialized) return;
  (editor as any).__pageSystemInitialized = true;
  
  addPagesPanelCSS();
  setupPagesTabInSidebar(editor);
  setupPageCommands(editor);
  setupPageListeners(editor);
  setupGuiReadAloudControls(editor);

  // The top bar button cannot reach the editor instance, so it sends an event.
  const onTopBarPersonalize = () => editor.runCommand('personalization:add-variant');
  window.addEventListener(GUI_PERSONALIZE_EVENT, onTopBarPersonalize);

  // The variant dropdown of the top bar switches the selected page between Base and a profile variant.
  const onTopBarVariantSelect = (event: Event) => {
    const page = editor.Pages?.getSelected();
    if (!page) return;
    const variantId = (event as CustomEvent<{ variantId?: string | null }>).detail?.variantId || null;
    switchVariant(editor, page, variantId);
    updatePagesList(editor);
    captureAnalyticsEvent('gui_personalization_variant_selected', { variant: variantId ? 'profile' : 'base' });
  };
  const onTopBarVariantsRequest = () => publishVariantState(editor);
  window.addEventListener(GUI_VARIANT_SELECT_EVENT, onTopBarVariantSelect);
  window.addEventListener(GUI_VARIANTS_REQUEST_EVENT, onTopBarVariantsRequest);
  editor.on('destroy', () => {
    window.removeEventListener(GUI_PERSONALIZE_EVENT, onTopBarPersonalize);
    window.removeEventListener(GUI_VARIANT_SELECT_EVENT, onTopBarVariantSelect);
    window.removeEventListener(GUI_VARIANTS_REQUEST_EVENT, onTopBarVariantsRequest);
    window.dispatchEvent(new CustomEvent(GUI_VARIANTS_STATE_EVENT, { detail: { options: [], activeId: null } }));
  });
  
  // Suppress harmless ResizeObserver warning in development
  if (import.meta.env.DEV) {
    window.addEventListener('error', e => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.stopImmediatePropagation();
      }
    }, true);
  }
}

export function loadDefaultPages(editor: Editor) {
  const pages = editor.Pages;
  if (!pages || pages.getAll().length > 0) return;
  
  const defaults = [
    { id: 'home', name: 'Home' },
    { id: 'about', name: 'About' },
    { id: 'contact', name: 'Contact' }
  ];
  
  defaults.forEach(p => pages.add(p));
  const homePage = pages.get('home');
  if (homePage) pages.select(homePage);
}

/**
 * Setup Pages as a proper tab in the GrapesJS right sidebar
 */
function setupPagesTabInSidebar(editor: Editor) {
  const panelManager = editor.Panels;
  
  // Add the Pages button to the views panel (alongside Blocks, Styles, Layers, etc.)
  editor.on('load', () => {
    // Create and append the pages panel to views-container
    createAndAppendPagesPanel(editor);
    
    panelManager.addButton('views', {
      id: 'open-pages-tab',
      className: 'fa fa-file-alt gjs-pn-btn',
      command: 'open-pages-tab',
      togglable: true,
      attributes: { title: 'Pages' },
      label: `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
        <path d="M19,5V19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M7,7H9V9H7V7M7,11H9V13H7V11M7,15H9V17H7V15M11,7H17V9H11V7M11,11H17V13H11V11M11,15H17V17H11V15Z" />
      </svg>`,
    });
    
    // Also remove the old floating panel button if exists
    try {
      panelManager.removeButton('options', 'open-pages');
    } catch {
      // Ignore if button doesn't exist
    }
    
    // Initialize the pages list after editor is loaded
    setTimeout(() => updatePagesList(editor), 100);
    
    // Listen for other panel buttons to restore their panels when clicked
    setupPanelSwitchListeners(editor);
  });

  // Add command to toggle pages panel
  editor.Commands.add('open-pages-tab', {
    run(editor: Editor, sender: any) {
      const pagesPanel = document.getElementById('gjs-pages-panel');
      if (pagesPanel) {
        pagesPanel.style.display = 'flex';
        updatePagesList(editor);
      }
      // Hide other panels (blocks, styles, layers, traits)
      hideOtherPanels();
      sender?.set?.('active', true);
    },
    stop(editor: Editor, sender: any) {
      const pagesPanel = document.getElementById('gjs-pages-panel');
      if (pagesPanel) {
        pagesPanel.style.display = 'none';
      }
      // Restore other panels visibility
      restoreOtherPanels();
      sender?.set?.('active', false);
    }
  });
}

/**
 * Setup listeners for other panel buttons to properly restore panels
 */
function setupPanelSwitchListeners(editor: Editor) {
  const panelManager = editor.Panels;
  
  // Get the views panel buttons (Blocks, Styles, Layers, etc.)
  const viewsPanel = panelManager.getPanel('views');
  if (!viewsPanel) return;
  
  const buttons = viewsPanel.get('buttons');
  if (!buttons) return;
  
  // Listen to each button's active state change
  buttons.forEach((btn: any) => {
    const btnId = btn.get('id');
    // Skip our pages tab button
    if (btnId === 'open-pages-tab') return;
    
    // When another button becomes active, hide pages panel and restore other panels
    btn.on('change:active', (model: any, active: boolean) => {
      if (active) {
        const pagesPanel = document.getElementById('gjs-pages-panel');
        if (pagesPanel) {
          pagesPanel.style.display = 'none';
        }
        restoreOtherPanels();
        
        // Deactivate pages button
        const pagesBtn = panelManager.getButton('views', 'open-pages-tab');
        if (pagesBtn) {
          pagesBtn.set('active', false);
        }
      }
    });
  });
}

/**
 * Create and append the Pages panel to views-container
 */
function createAndAppendPagesPanel(editor: Editor) {
  // Check if panel already exists
  if (document.getElementById('gjs-pages-panel')) return;
  
  const viewsContainer = document.querySelector('.gjs-pn-views-container');
  if (!viewsContainer) {
    console.warn('[Pages] views-container not found');
    return;
  }
  
  const container = document.createElement('div');
  container.id = 'gjs-pages-panel';
  container.className = 'gjs-pages-panel';
  container.style.display = 'none';
  
  container.innerHTML = `
    <div class="gjs-pages-header">
      <span class="gjs-pages-title">Pages</span>
    </div>
    <div class="gjs-pages-search-container">
      <input type="text" id="gjs-page-search" class="gjs-pages-search" placeholder="Search pages..." />
    </div>
    <div class="gjs-pages-actions">
      <button id="gjs-add-page-btn" class="gjs-pages-add-btn" title="Add new page" aria-label="Add new page">
        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
        </svg>
        <span>Add Page</span>
      </button>
    </div>
    <div id="gjs-pages-list" class="gjs-pages-list"></div>
  `;
  
  viewsContainer.appendChild(container);
  
  // Setup event listeners
  document.getElementById('gjs-add-page-btn')?.addEventListener('click', () => {
    editor.runCommand('add-page');
  });
  
  document.getElementById('gjs-page-search')?.addEventListener('input', (e) => {
    const term = (e.target as HTMLInputElement).value.toLowerCase();
    document.querySelectorAll('.gjs-page-item').forEach((item: any) => {
      const nameEl = item.querySelector('.gjs-page-name');
      const name = nameEl?.textContent?.toLowerCase() || '';
      item.style.display = name.includes(term) ? 'flex' : 'none';
    });
  });
}

/**
 * Hide other GrapesJS panels when Pages tab is active
 */
function hideOtherPanels() {
  // GrapesJS default panels
  const panelSelectors = [
    '.gjs-block-categories',
    '.gjs-blocks-c', 
    '.gjs-sm-sectors',
    '.gjs-layer-items',
    '.gjs-clm-tags',
    '.gjs-trt-traits',
  ];
  
  panelSelectors.forEach(selector => {
    const panel = document.querySelector(selector) as HTMLElement;
    if (panel) {
      panel.style.display = 'none';
    }
  });
}

/**
 * Restore other GrapesJS panels when switching away from Pages tab
 */
function restoreOtherPanels() {
  // Restore GrapesJS default panels
  const panelSelectors = [
    '.gjs-block-categories',
    '.gjs-blocks-c', 
    '.gjs-sm-sectors',
    '.gjs-layer-items',
    '.gjs-clm-tags',
    '.gjs-trt-traits',
  ];
  
  panelSelectors.forEach(selector => {
    const panel = document.querySelector(selector) as HTMLElement;
    if (panel) {
      panel.style.display = '';
    }
  });
}

// Tell the top bar which variants the selected page has (Base + one per profile).
function publishVariantState(editor: Editor) {
  try {
    const page = editor.Pages?.getSelected();
    const variants = page ? getPageVariants(page) : [];
    window.dispatchEvent(new CustomEvent(GUI_VARIANTS_STATE_EVENT, {
      detail: {
        options: variants.map((v) => ({ id: v.id, label: v.profileName })),
        activeId: page ? getActiveVariantId(page) : null,
      },
    }));
  } catch (err) {
    console.warn('[Personalization] could not publish variant state:', err);
  }
}

function updatePagesList(editor: Editor) {
  publishVariantState(editor);
  const list = document.getElementById('gjs-pages-list');
  if (!list || !editor.Pages) return;
  
  // Cancel any pending animation frame to prevent multiple updates
  if (pagesListRaf !== null) {
    cancelAnimationFrame(pagesListRaf);
  }
  
  // Defer DOM-heavy operations using requestAnimationFrame
  pagesListRaf = requestAnimationFrame(() => {
    pagesListRaf = null;
    
    const selected = editor.Pages.getSelected();
    list.innerHTML = '';
    
    editor.Pages.getAll().forEach((page: any) => {
     try {
      const pageRoute = getPageRoute(page);
      const variants = getPageVariants(page);
      const activeVariantId = getActiveVariantId(page);
      const item = document.createElement('div');
      item.className = 'gjs-page-item' + (selected?.getId() === page.getId() ? ' selected' : '');
      
      // Only the page name + route are shown here. Personalized variants are created with
      // the Personalize button and switched with the variant dropdown of the top bar.
      item.innerHTML = `
        <div class="gjs-page-info">
          <span class="gjs-page-name">${escapeHtml(page.getName())}</span>
          <span class="gjs-page-route">${pageRoute}</span>
        </div>
        <div class="gjs-page-actions">
          <button class="gjs-page-btn route-page-btn" title="Edit URL route" aria-label="Edit URL route">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C6.22,11.88 6.22,7.12 9.17,4.17C12.12,1.22 16.88,1.22 19.83,4.17C22.78,7.12 22.78,11.88 19.83,14.83C19.44,15.22 18.8,15.22 18.41,14.83C18,14.44 18,13.8 18.41,13.41C20.59,11.23 20.59,7.77 18.41,5.59C16.23,3.41 12.77,3.41 10.59,5.59C8.41,7.77 8.41,11.23 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C17.78,12.12 17.78,16.88 14.83,19.83C11.88,22.78 7.12,22.78 4.17,19.83C1.22,16.88 1.22,12.12 4.17,9.17C4.56,8.78 5.2,8.78 5.59,9.17C6,9.56 6,10.2 5.59,10.59C3.41,12.77 3.41,16.23 5.59,18.41C7.77,20.59 11.23,20.59 13.41,18.41C15.59,16.23 15.59,12.77 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z" />
            </svg>
          </button>
          <button class="gjs-page-btn rename-page-btn" title="Rename page" aria-label="Rename page">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
            </svg>
          </button>
          <button class="gjs-page-btn duplicate-page-btn" title="Duplicate page" aria-label="Duplicate page">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
            </svg>
          </button>
          <button class="gjs-page-btn read-aloud-btn" title="${isReadAloudVariant(page) ? 'Disable' : 'Enable'} read aloud" aria-label="Toggle read aloud" aria-pressed="${isReadAloudVariant(page)}" style="${isReadAloudVariant(page) ? 'color:#1d4ed8;' : ''}">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M3,9V15H7L12,20V4L7,9M16.5,12A4.5,4.5 0 0,0 14,7.97V16.02C15.5,15.29 16.5,13.77 16.5,12M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23Z" />
            </svg>
          </button>
          <button class="gjs-page-btn delete-page-btn" title="Delete page" aria-label="Delete page">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;">
              <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
            </svg>
          </button>
        </div>
        ${isReadAloudVariant(page) ? '<div class="gjs-page-audio-hint">Read aloud enabled · Use Play in the canvas</div>' : ''}
      `;
      
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'BUTTON' && !target.closest('button') && target.tagName !== 'SELECT' && target.tagName.toLowerCase() !== 'option') {
          editor.Pages.select(page);
        }
      });
      
      // Route edit button
      item.querySelector('.route-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentRoute = page.get('route_path') || '/' + page.getName().toLowerCase().replace(/\s+/g, '-');
        const newRoute = prompt('Enter URL route for this page (e.g., /about-us):', currentRoute);
        if (newRoute !== null) {
          // Ensure route starts with /
          let cleanRoute = newRoute.trim();
          if (cleanRoute && !cleanRoute.startsWith('/')) {
            cleanRoute = '/' + cleanRoute;
          }
          // Clean the route - only allow alphanumeric, hyphens, underscores, and slashes
          cleanRoute = cleanRoute.replace(/[^a-zA-Z0-9\-_\/]/g, '');
          page.set('route_path', cleanRoute || '/');
          updatePagesList(editor);
        }
      });
      
      item.querySelector('.rename-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Enter new page name:', page.getName());
        if (newName?.trim()) {
          page.set('name', newName.trim());
          updatePagesList(editor);
        }
      });
      
      item.querySelector('.duplicate-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const originalName = page.getName();
        const newName = prompt('Enter name for duplicated page:', originalName + ' Copy');
        if (!newName?.trim()) return;
        const newPage = editor.Pages?.add({ id: createUniquePageId(newName), name: newName.trim() });
        if (newPage) {
          editor.Pages.select(newPage);
        }
        updatePagesList(editor);
      });

      // Read aloud toggle: works on the live canvas of Base or the active variant,
      // regardless of any user model. Only the selected page has a mounted canvas.
      item.querySelector('.read-aloud-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (editor.Pages.getSelected()?.getId() !== page.getId()) editor.Pages.select(page);
        const enable = !isReadAloudVariant(page);
        setPageReadAloud(page, enable);
        const activeId = getActiveVariantId(page);
        if (activeId) {
          const all = getPageVariants(page);
          const idx = all.findIndex((v) => v.id === activeId);
          if (idx >= 0) {
            all[idx] = { ...all[idx], readAloudEnabled: enable };
            setPageVariants(page, all);
          }
        }
        saveActiveLive(editor, page);
        updatePagesList(editor);
      });

      
      item.querySelector('.delete-page-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Removes the whole page (and therefore every variant on it).
        const removePageEntirely = async () => {
          // Prevent deleting the last page
          if (editor.Pages.getAll().length <= 1) {
            await globalConfirm({
              title: 'Cannot Delete Page',
              description: 'Cannot delete the last page. At least one page is required.',
              confirmLabel: 'OK',
              cancelLabel: 'OK',
            });
            return;
          }

          // If deleting the selected page, select another one first
          if (editor.Pages.getSelected()?.getId() === page.getId()) {
            const allPages = editor.Pages.getAll();
            const currentIndex = allPages.findIndex((p: any) => p.getId() === page.getId());
            const nextPage = allPages[currentIndex + 1] || allPages[currentIndex - 1];
            if (nextPage) {
              editor.Pages.select(nextPage);
            }
          }

          editor.Pages.remove(page);
          updatePagesList(editor);
        };

        const variants = getPageVariants(page);

        // No variants — keep the simple confirm.
        if (variants.length === 0) {
          const confirmed = await globalConfirm({
            title: 'Delete Page',
            description: 'Delete page "' + page.getName() + '"?',
            confirmLabel: 'Delete',
            variant: 'danger',
          });
          if (confirmed) await removePageEntirely();
          return;
        }

        // Has variants — let the user delete a single variant or the whole page.
        openPageDeleteModal(editor, page, {
          deleteEntirePage: () => {
            void removePageEntirely();
          },
          deleteVariant: (variantId) => {
            setPageVariants(
              page,
              getPageVariants(page).filter((v) => v.id !== variantId),
            );
            // If the deleted variant was active, fall back to Base content.
            if (getActiveVariantId(page) === variantId) {
              const base = getBaseSnapshot(page);
              if (base) applySnapshot(editor, page, base);
              setActiveVariantId(page, null);
            }
            updatePagesList(editor);
            captureAnalyticsEvent('gui_personalization_variant_deleted');
          },
        });
      });
      
      list.appendChild(item);
     } catch (err) {
       // A single broken page must not blank the entire panel — render a
       // minimal, still-selectable fallback row and keep going.
       console.error('[Pages] Failed to render a page item; using fallback:', err);
       try {
         const fallback = document.createElement('div');
         fallback.className = 'gjs-page-item';
         const label = (() => {
           try {
             return page?.getName?.() || 'Untitled page';
           } catch {
             return 'Untitled page';
           }
         })();
         fallback.innerHTML = `<div class="gjs-page-info"><span class="gjs-page-name">${label}</span></div>`;
         fallback.addEventListener('click', () => {
           try {
             editor.Pages.select(page);
           } catch {
             /* ignore */
           }
         });
         list.appendChild(fallback);
       } catch {
         /* give up on this row */
       }
     }
    });
  });
}

function setupPageCommands(editor: Editor) {
  // Legacy command for backwards compatibility - now redirects to the new tab command
  editor.Commands.add('show-pages', {
    run() {
      editor.runCommand('open-pages-tab');
    },
    stop() {
      editor.stopCommand('open-pages-tab');
    }
  });
  
  editor.Commands.add('add-page', {
    run() {
      const name = prompt('Enter page name:');
      if (!name?.trim() || !editor.Pages) return;

      const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      const page = editor.Pages.add({ id, name: name.trim() });
      if (page) {
        editor.Pages.select(page);
        updatePagesList(editor);
      }
    }
  });

  // Flush the live canvas of the currently-selected page into its active
  // base/variant snapshot. Used before web-app generation so the just-edited
  // page is captured into besserBaseSnapshot/besserPageVariants (which are what
  // per-version generation reads) — the live canvas holds edits that haven't
  // been written back to the active snapshot until a variant switch.
  // Start the "create personalized variant" flow for the selected page. Used by
  // the Personalize button in the top bar, which lives outside the editor.
  editor.Commands.add('personalization:add-variant', {
    run() {
      const pages = editor.Pages?.getAll() ?? [];
      if (pages.length) void openAddVariantModal(editor, pages, { choosePages: true });
    },
  });

  editor.Commands.add('personalization:flush-active', {
    run() {
      try {
        const page = editor.Pages?.getSelected();
        if (page) saveActiveLive(editor, page);
      } catch (err) {
        console.warn('[Personalization] flush-active failed:', err);
      }
    },
  });
}

function setupPageListeners(editor: Editor) {
  // Ensure listeners aren't added multiple times
  if ((editor as any).__pagesListenersAttached) return;
  (editor as any).__pagesListenersAttached = true;
  
  const events = ['page:add', 'page:remove', 'page:select', 'page:update'];
  events.forEach(event => editor.on(event, () => updatePagesList(editor)));
  
  editor.on('load', () => {
    setTimeout(() => {
      loadDefaultPages(editor);
      updatePagesList(editor);
    }, 500);
  });
}

function addPagesPanelCSS() {
  // Check if CSS is already added
  if (document.getElementById('gjs-pages-panel-css')) return;
  
  const style = document.createElement('style');
  style.id = 'gjs-pages-panel-css';
  style.textContent = `
    /* Pages Panel - Integrated into GrapesJS sidebar */
    .gjs-pages-panel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .gjs-pages-header {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: 10px 12px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }
    
    .gjs-pages-title {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .gjs-pages-actions {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
    }
    
    .gjs-pages-add-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 34px;
      background: #0066cc;
      border: none;
      border-radius: 4px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .gjs-pages-add-btn:hover {
      background: #0052a3;
    }
    
    .gjs-pages-add-btn svg {
      flex-shrink: 0;
    }
    
    .gjs-pages-search-container {
      padding: 8px 12px;
    }
    
    .gjs-pages-search {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      background: #fff;
      color: #333;
      box-sizing: border-box;
    }
    
    .gjs-pages-search:focus {
      outline: none;
      border-color: #0066cc;
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
    }
    
    .gjs-pages-search::placeholder {
      color: #999;
    }
    
    .gjs-pages-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    
    .gjs-page-item {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 10px 12px;
      margin-bottom: 4px;
      background: #f9f9f9;
      border: 1px solid #eee;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .gjs-page-item:hover {
      background: #f0f0f0;
      border-color: #0066cc;
    }
    
    .gjs-page-item.selected {
      background: #0066cc;
      border-color: #0066cc;
    }
    
    .gjs-page-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }

    .gjs-page-profile {
      display: inline-flex;
      align-self: flex-start;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.12);
      color: #1d4ed8;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    
    .gjs-page-name {
      font-size: 13px;
      font-weight: 500;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .gjs-page-route {
      font-size: 11px;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
    }
    
    .gjs-page-item.selected .gjs-page-name {
      color: #fff;
    }
    
    .gjs-page-item.selected .gjs-page-route {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .gjs-page-actions {
      display: none;
      flex-wrap: wrap;
      gap: 4px;
      justify-content: flex-end;
      align-items: center;
    }
    .gjs-page-audio-hint { font-size:12px; color:#174ea6; }
    .gjs-page-item.selected .gjs-page-audio-hint { color:#fff; }

    .gjs-page-item:hover .gjs-page-actions,
    .gjs-page-item.selected .gjs-page-actions {
      display: flex;
    }
    
    .gjs-page-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: #666;
      transition: all 0.2s;
    }
    
    .gjs-page-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }
    
    .gjs-page-item.selected .gjs-page-btn {
      color: rgba(255, 255, 255, 0.8);
    }
    
    .gjs-page-item.selected .gjs-page-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    
    .gjs-page-btn.delete-page-btn:hover {
      background: #e74c3c;
      color: white;
    }
    
    .gjs-page-item.selected .gjs-page-btn.delete-page-btn:hover {
      background: #c0392b;
    }
    
    /* Scrollbar styling */
    .gjs-pages-list::-webkit-scrollbar {
      width: 6px;
    }
    
    .gjs-pages-list::-webkit-scrollbar-track {
      background: #f5f5f5;
    }
    
    .gjs-pages-list::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }
    
    .gjs-pages-list::-webkit-scrollbar-thumb:hover {
      background: #999;
    }
    
    /* Hide the old floating panel if it exists */
    .pages-panel-container {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

