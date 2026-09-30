/**
 * JSON exports record the BESSER version (as the backend reports it) and the
 * editor version (BESSER issue #617). Importing files with or without these
 * fields must keep working, and they must not leak into the stored project.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProjectExportEnvelope } from '../projectExportUtils';
import { createDefaultProject } from '../../types/project';
import { _resetBesserVersionCacheForTests, loadBesserVersion } from '../../services/besserVersion';
import { importProjectFromJson } from '../../services/project-import/projectImport';

const EDITOR_VERSION = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../../package.json'), 'utf-8'),
).version;

const stubBackend = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));

const jsonFile = (data: unknown) => new File([JSON.stringify(data)], 'project.json', { type: 'application/json' });

beforeEach(() => _resetBesserVersionCacheForTests());
afterEach(() => vi.unstubAllGlobals());

describe('export version metadata', () => {
  it('stamps the backend BESSER version and the editor version on the project envelope', async () => {
    stubBackend({ besser_version: '8.0.0' });
    await loadBesserVersion();

    const env = buildProjectExportEnvelope(createDefaultProject('P', 'd', 'o'));

    expect(env.besserVersion).toBe('8.0.0');
    expect(env.editorVersion).toBe(EDITOR_VERSION);
    // The envelope format version is a separate thing and stays pinned.
    expect(env.version).toBe('2.0.0');
  });

  it('omits besserVersion when the backend cannot be reached, rather than guessing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(loadBesserVersion()).resolves.toBeUndefined();

    const env = buildProjectExportEnvelope(createDefaultProject('P', 'd', 'o'));

    expect('besserVersion' in env).toBe(false);
    expect(env.editorVersion).toBe(EDITOR_VERSION);
  });

  it('omits besserVersion when the backend is too old to report one', async () => {
    stubBackend({ message: 'BESSER Backend API', version: '1.0.0' });
    await loadBesserVersion();
    expect('besserVersion' in buildProjectExportEnvelope(createDefaultProject('P', 'd', 'o'))).toBe(false);
  });
});

describe('importing JSON with and without version metadata', () => {
  const exported = () => {
    const env = buildProjectExportEnvelope(createDefaultProject('Library', 'd', 'o'));
    return JSON.parse(JSON.stringify(env));
  };

  it('imports an old export that has no version fields', async () => {
    const legacy = exported();
    delete legacy.besserVersion;
    delete legacy.editorVersion;

    const project = await importProjectFromJson(jsonFile(legacy));

    expect(project.name).toBe('Library');
  });

  it('imports a new export and keeps the version fields out of the stored project', async () => {
    const current = { ...exported(), besserVersion: '8.0.0', editorVersion: EDITOR_VERSION };

    const project = await importProjectFromJson(jsonFile(current));

    expect(project.name).toBe('Library');
    expect(project).not.toHaveProperty('besserVersion');
    expect(project).not.toHaveProperty('editorVersion');
  });

  it('imports a single-diagram export that carries version fields', async () => {
    const project = createDefaultProject('Library', 'd', 'o');
    const diagram = { ...project.diagrams.ClassDiagram[0], besserVersion: '8.0.0', editorVersion: EDITOR_VERSION };

    const imported = await importProjectFromJson(jsonFile(diagram));

    expect(imported.currentDiagramType).toBe('ClassDiagram');
    expect(imported.diagrams.ClassDiagram[0]).not.toHaveProperty('besserVersion');
  });
});
