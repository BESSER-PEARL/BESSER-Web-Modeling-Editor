import { describe, it, expect } from 'vitest';
import {
  collectVariantProfiles,
  buildVersionGuiModel,
  buildAllWebAppVersions,
  slugify,
} from '../buildWebAppVersions';
import type { GrapesJSProjectData } from '../../types/project';

// ── Fixtures ────────────────────────────────────────────────────────────────

const comp = (id: string) => ({ type: 'text', attributes: { id } });
const rule = (sel: string, pageId?: string) => ({
  selectors: [sel],
  style: { color: 'red' },
  ...(pageId ? { pageId } : {}),
});

/**
 * Model with:
 *  - "home": has a Clinician variant + a base snapshot; live frame currently
 *    shows the Clinician content (to prove we resolve from snapshots, not frames).
 *  - "profile" page: has a Patient variant + base snapshot.
 *  - "about": no variants at all (should stay untouched in every version).
 */
const makeModel = (): GrapesJSProjectData => ({
  pages: [
    {
      id: 'home',
      name: 'Home',
      // Live frame = clinician content (what was mounted when serialized).
      frames: [{ component: { components: [comp('home-clinician-live')] } }],
      besserPageVariants: JSON.stringify([
        {
          id: 'v-clin',
          profileId: 'clinician',
          profileName: 'Clinician',
          snapshot: {
            components: [comp('home-clinician')],
            css: [rule('#home-clinician', 'home')],
          },
        },
      ]),
      besserBaseSnapshot: JSON.stringify({
        components: [comp('home-base')],
        css: [rule('#home-base', 'home')],
      }),
      besserActiveVariantId: 'v-clin',
    },
    {
      id: 'profile',
      name: 'Profile',
      frames: [{ component: { components: [comp('profile-base-live')] } }],
      besserPageVariants: JSON.stringify([
        {
          id: 'v-pat',
          profileId: 'patient',
          profileName: 'Patient',
          snapshot: {
            components: [comp('profile-patient')],
            css: [rule('#profile-patient', 'profile')],
          },
        },
      ]),
      besserBaseSnapshot: JSON.stringify({
        components: [comp('profile-base')],
        css: [rule('#profile-base', 'profile')],
      }),
      besserActiveVariantId: null,
    },
    {
      id: 'about',
      name: 'About',
      frames: [{ component: { components: [comp('about-content')] } }],
    },
  ],
  styles: [
    rule('#home-old', 'home'), // stale home rule → must be dropped for resolved pages
    rule('#profile-old', 'profile'),
    rule('.global'), // no pageId → kept everywhere
    rule('#about', 'about'), // untouched page → kept
  ],
  assets: [],
  symbols: [],
  version: '0.21.13',
});

const childIds = (model: GrapesJSProjectData, pageId: string): string[] => {
  const page = model.pages.find((p: any) => p.id === pageId);
  return (page?.frames?.[0]?.component?.components ?? []).map((c: any) => c.attributes?.id);
};
const selectors = (model: GrapesJSProjectData): string[] =>
  model.styles.map((s: any) => s.selectors?.[0]);

// ── slugify ───────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases, replaces non-alphanumerics, and never returns empty', () => {
    expect(slugify('Clinician Pro!')).toBe('clinician-pro');
    expect(slugify('  ')).toBe('version');
    expect(slugify('---')).toBe('version');
  });
});

// ── collectVariantProfiles ───────────────────────────────────────────────────

describe('collectVariantProfiles', () => {
  it('returns [] when no page has variants', () => {
    const model: GrapesJSProjectData = {
      pages: [{ id: 'a', name: 'A', frames: [{ component: { components: [] } }] }],
      styles: [],
      assets: [],
      symbols: [],
      version: '0',
    };
    expect(collectVariantProfiles(model)).toEqual([]);
  });

  it('dedups profiles across pages', () => {
    const profiles = collectVariantProfiles(makeModel());
    expect(profiles).toEqual([
      { profileId: 'clinician', profileName: 'Clinician' },
      { profileId: 'patient', profileName: 'Patient' },
    ]);
  });
});

// ── buildVersionGuiModel ─────────────────────────────────────────────────────

describe('buildVersionGuiModel', () => {
  it('base version resolves every variant page from its base snapshot (not the live frame)', () => {
    const base = buildVersionGuiModel(makeModel(), null);
    expect(childIds(base, 'home')).toEqual(['home-base']);
    expect(childIds(base, 'profile')).toEqual(['profile-base']);
    // Untouched page keeps its own content.
    expect(childIds(base, 'about')).toEqual(['about-content']);
  });

  it('profile version uses the matching variant and falls back to base elsewhere', () => {
    const clin = buildVersionGuiModel(makeModel(), 'clinician');
    // home has a clinician variant → use it.
    expect(childIds(clin, 'home')).toEqual(['home-clinician']);
    // profile has no clinician variant → fall back to its base snapshot.
    expect(childIds(clin, 'profile')).toEqual(['profile-base']);
    // about has no variants → untouched.
    expect(childIds(clin, 'about')).toEqual(['about-content']);
  });

  it('rebuilds styles: drops stale rules for resolved pages, keeps globals + untouched pages', () => {
    const base = buildVersionGuiModel(makeModel(), null);
    const sels = selectors(base);
    // Stale per-page rules for resolved pages are dropped...
    expect(sels).not.toContain('#home-old');
    expect(sels).not.toContain('#profile-old');
    // ...and replaced by the chosen snapshots' CSS.
    expect(sels).toContain('#home-base');
    expect(sels).toContain('#profile-base');
    // Global + untouched page rules are preserved.
    expect(sels).toContain('.global');
    expect(sels).toContain('#about');
  });

  it('strips variant blobs from the produced model', () => {
    const base = buildVersionGuiModel(makeModel(), null) as any;
    for (const page of base.pages) {
      expect(page.besserPageVariants).toBeUndefined();
      expect(page.besserBaseSnapshot).toBeUndefined();
      expect(page.besserActiveVariantId).toBeUndefined();
    }
  });

  it('does not mutate the input model', () => {
    const model = makeModel();
    const before = JSON.stringify(model);
    buildVersionGuiModel(model, 'clinician');
    expect(JSON.stringify(model)).toBe(before);
  });
});

// ── buildAllWebAppVersions ───────────────────────────────────────────────────

describe('buildAllWebAppVersions', () => {
  it('returns [] when the model has no variants', () => {
    const model: GrapesJSProjectData = {
      pages: [{ id: 'a', name: 'A', frames: [{ component: { components: [] } }] }],
      styles: [],
      assets: [],
      symbols: [],
      version: '0',
    };
    expect(buildAllWebAppVersions(model, 'all', null)).toEqual([]);
  });

  it('"all" produces base + every profile with unique slugs', () => {
    const versions = buildAllWebAppVersions(makeModel(), 'all', null);
    expect(versions.map((v) => v.slug)).toEqual(['base', 'clinician', 'patient']);
    expect(versions.map((v) => v.name)).toEqual(['Base', 'Clinician', 'Patient']);
    expect(childIds(versions[1].guiModel, 'home')).toEqual(['home-clinician']);
  });

  it('"base" produces a single base version', () => {
    const versions = buildAllWebAppVersions(makeModel(), 'base', null);
    expect(versions).toHaveLength(1);
    expect(versions[0].slug).toBe('base');
    expect(childIds(versions[0].guiModel, 'home')).toEqual(['home-base']);
  });

  it('"profile" produces a single selected-profile version', () => {
    const versions = buildAllWebAppVersions(makeModel(), 'profile', 'patient');
    expect(versions).toHaveLength(1);
    expect(versions[0].slug).toBe('patient');
    expect(childIds(versions[0].guiModel, 'profile')).toEqual(['profile-patient']);
  });

  it('"profile" with an unknown selection falls back to base', () => {
    const versions = buildAllWebAppVersions(makeModel(), 'profile', 'ghost');
    expect(versions).toHaveLength(1);
    expect(versions[0].slug).toBe('base');
  });

  it('reserves the "base" slug when a profile is literally named "Base"', () => {
    const model = makeModel();
    // Rename the clinician profile to "Base" to force a slug collision.
    (model.pages[0] as any).besserPageVariants = JSON.stringify([
      {
        id: 'v-clin',
        profileId: 'clinician',
        profileName: 'Base',
        snapshot: { components: [comp('home-clinician')], css: [] },
      },
    ]);
    const versions = buildAllWebAppVersions(model, 'all', null);
    expect(versions.map((v) => v.slug)).toEqual(['base', 'base-2', 'patient']);
  });
});
