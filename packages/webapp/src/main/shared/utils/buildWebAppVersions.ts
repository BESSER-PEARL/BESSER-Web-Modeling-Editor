/**
 * buildWebAppVersions
 *
 * Pure helpers that turn a stored GrapesJS GUI model (with per-page
 * personalization variants) into one or more **complete** GUI models — one per
 * "version" to generate.
 *
 * A *version* is a full web app in which every page uses that profile's variant
 * if it has one, and the Base page otherwise. These helpers are intentionally
 * free of any GrapesJS / editor dependency: they operate purely on the
 * serialized `GrapesJSProjectData` JSON that lives in project storage, so they
 * can run at generation time without the live editor being mounted.
 *
 * The variant data is persisted on each serialized page by the GUI editor
 * (see features/editors/gui/setup/setupPageSystem.ts): `besserPageVariants`
 * (JSON string of PageVariant[]) and `besserBaseSnapshot` (JSON string of a
 * PageSnapshot). The shapes below MUST stay in sync with that file.
 */

import type { GrapesJSProjectData } from '../types/project';

/** Serialized page content: the wrapper's child components + its scoped CSS. */
type PageSnapshot = {
  // Children of the page's main (wrapper) component — i.e. main.components().toJSON().
  components: any[];
  // CSS rule JSONs styling this page's content (each rule carries a pageId).
  css: any[];
};

/** One personalized variant of a page, keyed to a user profile (UserDiagram). */
type PageVariant = {
  id: string;
  profileId: string;
  profileName: string;
  snapshot: PageSnapshot;
};

const VARIANT_FIELD = 'besserPageVariants';
const BASE_SNAPSHOT_FIELD = 'besserBaseSnapshot';

/** Selection mode chosen in the Web App generation dialog. */
export type WebAppVersionMode = 'base' | 'profile' | 'all';

/** A user profile that has at least one page variant somewhere in the model. */
export interface VersionProfile {
  profileId: string;
  profileName: string;
}

/** A concrete version to hand to the backend (folder slug + full GUI model). */
export interface WebAppVersion {
  /** Sanitized, unique folder name (e.g. "base", "clinician"). */
  slug: string;
  /** Human-readable name (e.g. "Base", "Clinician"). */
  name: string;
  /** Complete GrapesJS-format GUI model for this version. */
  guiModel: GrapesJSProjectData;
}

// The variant fields are persisted as JSON strings, but tolerate already-parsed
// objects (defensive against future storage/serialization changes).
function parseJsonField<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as T;
  return null;
}

// Custom attrs may live top-level on the serialized page or under `attributes`
// depending on the GrapesJS serializer; read both.
function readPageField(page: any, field: string): unknown {
  return page?.[field] ?? page?.attributes?.[field];
}

function getPageVariants(page: any): PageVariant[] {
  const parsed = parseJsonField<PageVariant[]>(readPageField(page, VARIANT_FIELD));
  return Array.isArray(parsed) ? parsed : [];
}

function getBaseSnapshot(page: any): PageSnapshot | null {
  return parseJsonField<PageSnapshot>(readPageField(page, BASE_SNAPSHOT_FIELD));
}

/** Slugify a display name into a safe folder segment. Never returns empty. */
export const slugify = (value: string): string =>
  (value || 'version')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'version';

/**
 * Collect the distinct user profiles that have at least one page variant across
 * the whole model. Returns [] when NO page has any variant (⇒ unchanged,
 * single-app generation).
 */
export const collectVariantProfiles = (
  model: GrapesJSProjectData | undefined | null,
): VersionProfile[] => {
  const pages = Array.isArray((model as any)?.pages) ? (model as any).pages : [];
  const seen = new Map<string, string>(); // profileId -> profileName
  for (const page of pages) {
    for (const v of getPageVariants(page)) {
      if (v?.profileId && !seen.has(v.profileId)) {
        seen.set(v.profileId, v.profileName || v.profileId);
      }
    }
  }
  return Array.from(seen, ([profileId, profileName]) => ({ profileId, profileName }));
};

/**
 * Build a complete GUI model for a single version.
 *
 * @param model      the stored base GUI model
 * @param profileId  null ⇒ Base version; otherwise the target profile's id
 *
 * Per page:
 *  - No variants at all ⇒ leave the page's existing content + styles untouched.
 *  - Base version ⇒ use the page's besserBaseSnapshot.
 *  - Profile version ⇒ use the matching variant snapshot, else the base snapshot.
 *
 * The page's wrapper children are replaced with the chosen snapshot's
 * components, and the flat top-level `styles` array is rebuilt so each resolved
 * page contributes exactly its snapshot's CSS (globals and untouched pages'
 * rules are preserved).
 */
export const buildVersionGuiModel = (
  model: GrapesJSProjectData,
  profileId: string | null,
): GrapesJSProjectData => {
  const clone: GrapesJSProjectData = structuredClone(model);
  const pages = Array.isArray(clone.pages) ? clone.pages : [];
  const resolvedPageIds = new Set<string>();
  const appendedCss: any[] = [];

  for (const page of pages) {
    const variants = getPageVariants(page);
    if (variants.length === 0) {
      // Page never entered the personalization system — keep it as-is.
      continue;
    }

    const baseSnapshot = getBaseSnapshot(page);
    const snapshot: PageSnapshot | null =
      profileId === null
        ? baseSnapshot
        : (variants.find((v) => v.profileId === profileId)?.snapshot ?? baseSnapshot);

    if (!snapshot) {
      // Variants exist but no base snapshot recorded — safest is to leave the
      // current frame content and its styles untouched.
      continue;
    }

    const pageId: string | undefined = page?.id;

    // (b) Swap the wrapper's children for the chosen snapshot's components.
    const wrapper = page?.frames?.[0]?.component;
    if (wrapper) {
      wrapper.components = structuredClone(snapshot.components ?? []);
    }

    // (c) Collect this page's CSS; stamp pageId on any rule missing it so the
    //     styles-array rebuild below can group/keep rules consistently.
    if (pageId) resolvedPageIds.add(pageId);
    for (const rule of snapshot.css ?? []) {
      const cloned = structuredClone(rule);
      if (pageId && cloned && cloned.pageId == null) cloned.pageId = pageId;
      appendedCss.push(cloned);
    }
  }

  // Rebuild the flat styles array: keep globals (no pageId) and rules for pages
  // we did NOT resolve; drop the resolved pages' old rules; append the chosen
  // snapshots' CSS.
  const baseStyles = Array.isArray(clone.styles) ? clone.styles : [];
  const keptStyles = baseStyles.filter(
    (rule: any) => !rule?.pageId || !resolvedPageIds.has(rule.pageId),
  );
  clone.styles = [...keptStyles, ...appendedCss];

  // The variant blobs are only needed to *build* versions; the backend ignores
  // them. Strip them so each version payload doesn't carry every profile's
  // snapshots (which would bloat the "All versions" request N-fold).
  for (const page of pages) {
    delete page[VARIANT_FIELD];
    delete page[BASE_SNAPSHOT_FIELD];
    delete page.besserActiveVariantId;
    if (page.attributes) {
      delete page.attributes[VARIANT_FIELD];
      delete page.attributes[BASE_SNAPSHOT_FIELD];
      delete page.attributes.besserActiveVariantId;
    }
  }

  return clone;
};

/**
 * Build the ordered list of versions to generate for the chosen mode.
 * Returns [] when the model has no variants at all (caller then generates a
 * single, unchanged app).
 *
 * Slugs are unique; "base" is reserved for the Base version (a profile literally
 * named "Base" is disambiguated to "base-2", etc.).
 */
export const buildAllWebAppVersions = (
  model: GrapesJSProjectData,
  mode: WebAppVersionMode,
  selectedProfileId: string | null,
): WebAppVersion[] => {
  const profiles = collectVariantProfiles(model);
  if (profiles.length === 0) return [];

  const usedSlugs = new Set<string>();
  const uniqueSlug = (base: string): string => {
    const root = base || 'version';
    let candidate = root;
    let i = 2;
    while (usedSlugs.has(candidate)) candidate = `${root}-${i++}`;
    usedSlugs.add(candidate);
    return candidate;
  };

  const baseVersion = (): WebAppVersion => ({
    slug: uniqueSlug('base'),
    name: 'Base',
    guiModel: buildVersionGuiModel(model, null),
  });
  const profileVersion = (p: VersionProfile): WebAppVersion => ({
    slug: uniqueSlug(slugify(p.profileName)),
    name: p.profileName,
    guiModel: buildVersionGuiModel(model, p.profileId),
  });

  if (mode === 'base') return [baseVersion()];

  if (mode === 'profile') {
    const p = profiles.find((x) => x.profileId === selectedProfileId);
    // Fall back to Base if the selected profile vanished.
    return p ? [profileVersion(p)] : [baseVersion()];
  }

  // 'all' → Base first (reserves the "base" slug), then every profile.
  return [baseVersion(), ...profiles.map(profileVersion)];
};
