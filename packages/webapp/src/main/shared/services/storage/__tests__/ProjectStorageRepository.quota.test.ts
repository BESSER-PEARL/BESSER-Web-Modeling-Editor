import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: toastMock }));

import { ProjectStorageRepository } from '../ProjectStorageRepository';
import { createDefaultProject } from '../../../types/project';
import { localStorageProjectPrefix, localStorageProjectsList } from '../../../constants/constant';

/** localStorage with Chrome's quota (~5.2M characters of keys plus values). */
class QuotaStorage {
  private readonly entries = new Map<string, string>();
  constructor(private readonly limitChars = 5 * 1024 * 1024) {}
  get length() {
    return this.entries.size;
  }
  key(i: number) {
    return [...this.entries.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.entries.get(k) ?? null;
  }
  removeItem(k: string) {
    this.entries.delete(k);
  }
  clear() {
    this.entries.clear();
  }
  used() {
    let n = 0;
    this.entries.forEach((v, k) => (n += k.length + v.length));
    return n;
  }
  setItem(k: string, v: string) {
    const current = this.entries.get(k);
    const next = this.used() - (current === undefined ? 0 : k.length + current.length) + k.length + v.length;
    if (next > this.limitChars) throw new DOMException('quota', 'QuotaExceededError');
    this.entries.set(k, String(v));
  }
}

const v3ClassModel = {
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 400, height: 300 },
  interactive: { elements: {}, relationships: {} },
  elements: { c1: { id: 'c1', name: 'Book', type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 160, height: 100 } } },
  relationships: {},
  assessments: {},
};

/** A develop-era (v3) project of roughly `chars` characters, stored as the old editor left it. */
const storeV3Project = (name: string, chars: number): string => {
  const project = createDefaultProject(name, 'x'.repeat(chars), '') as any;
  project.schemaVersion = 4;
  project.diagrams.ClassDiagram[0].model = v3ClassModel;
  localStorage.setItem(`${localStorageProjectPrefix}${project.id}`, JSON.stringify(project));
  const list = JSON.parse(localStorage.getItem(localStorageProjectsList) ?? '[]');
  localStorage.setItem(localStorageProjectsList, JSON.stringify([...list, project.id]));
  return project.id;
};

const backupKeys = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.endsWith('_v3backup')) keys.push(k);
  }
  return keys;
};

// Live report: listing projects backed up EVERY stored v3 project, doubling
// storage; once full, new projects and templates failed to save
// ("Failed to save project").
describe('pre-migration backups and the storage quota', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new QuotaStorage() });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    toastMock.error.mockClear();
  });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    vi.restoreAllMocks();
  });

  it('listing projects writes no backups', () => {
    storeV3Project('A', 1000);
    storeV3Project('B', 1000);
    expect(ProjectStorageRepository.getAllProjects().map((p) => p.name).sort()).toEqual(['A', 'B']);
    expect(backupKeys()).toEqual([]);
  });

  it('still saves a new project after listing many large v3 projects', () => {
    for (const name of ['A', 'B', 'C', 'D']) storeV3Project(name, 1_000_000);
    ProjectStorageRepository.getAllProjects();
    const fresh = createDefaultProject('New', 'y'.repeat(400_000), '');
    expect(() => ProjectStorageRepository.saveProject(fresh)).not.toThrow();
  });

  it('skips the backup of an opened project when storage is nearly full', () => {
    const ids = ['A', 'B', 'C', 'D'].map((name) => storeV3Project(name, 1_000_000));
    expect(ProjectStorageRepository.loadProject(ids[0])).not.toBeNull();
    expect(backupKeys()).toEqual([]);
  });

  it('removes backups to make room for a save instead of failing it', () => {
    const a = storeV3Project('A', 1_000_000);
    const b = storeV3Project('B', 1_000_000);
    ProjectStorageRepository.loadProject(a);
    ProjectStorageRepository.loadProject(b);
    expect(backupKeys()).toHaveLength(2);

    const big = createDefaultProject('Big', 'z'.repeat(1_500_000), '');
    expect(() => ProjectStorageRepository.saveProject(big)).not.toThrow();
    expect(backupKeys()).toEqual([]);
    expect(ProjectStorageRepository.loadProject(big.id)?.name).toBe('Big');
  });

  it('tells the user when a save fails because storage is full', () => {
    localStorage.setItem('besser_other', 'o'.repeat(5_000_000));
    const project = createDefaultProject('P', 'p'.repeat(500_000), '');
    expect(() => ProjectStorageRepository.saveProject(project)).toThrow('Failed to save project');
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('storage is full'), expect.anything());
  });
});
