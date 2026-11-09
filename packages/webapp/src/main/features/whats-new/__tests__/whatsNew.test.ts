import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStorageLatestProject, localStorageWhatsNewSeen } from '../../../shared/constants/constant';
import { compareVersions, countUnread, markAllSeen, WHATS_NEW, type WhatsNewEntry } from '../whatsNew';

const memoryStorage = (initial: Record<string, string> = {}): Storage => {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
};

const entries: WhatsNewEntry[] = [
  { id: 'c', version: '8.7.0', date: '2026-11-02' },
  { id: 'b', version: '8.6.0', date: '2026-10-30' },
  { id: 'a', version: '8.5.0', date: '2026-10-28' },
];

describe('countUnread', () => {
  it('counts every entry for a returning user who never opened the panel', () => {
    // The case that prompted the feature: a browser with a project saved before
    // the Knowledge Graph release never learnt the new editor exists.
    const storage = memoryStorage({ [localStorageLatestProject]: 'p1' });
    expect(countUnread(entries, storage)).toBe(3);
  });

  it('shows nothing on a first visit and records the newest version as seen', () => {
    const storage = memoryStorage();
    expect(countUnread(entries, storage)).toBe(0);
    expect(storage.getItem(localStorageWhatsNewSeen)).toBe('8.7.0');
  });

  it('counts only the entries newer than the version last seen', () => {
    expect(countUnread(entries, memoryStorage({ [localStorageWhatsNewSeen]: '8.5.0' }))).toBe(2);
    expect(countUnread(entries, memoryStorage({ [localStorageWhatsNewSeen]: '8.7.0' }))).toBe(0);
  });

  it('counts by version, so an entry trimmed off the list does not reset the count', () => {
    expect(countUnread(entries, memoryStorage({ [localStorageWhatsNewSeen]: '8.1.0' }))).toBe(3);
  });

  it('shows nothing when storage is unavailable', () => {
    const broken = memoryStorage();
    broken.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(countUnread(entries, broken)).toBe(0);
  });
});

describe('with the browser storage blocked', () => {
  afterEach(() => vi.restoreAllMocks());

  it('neither counting nor marking throws when reading localStorage itself throws', () => {
    // Blocked site data: the localStorage getter throws a SecurityError.
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(countUnread(entries)).toBe(0);
    expect(() => markAllSeen(entries)).not.toThrow();
  });
});

describe('markAllSeen', () => {
  it('records the newest version', () => {
    const storage = memoryStorage({ [localStorageWhatsNewSeen]: '8.5.0' });
    markAllSeen(entries, storage);
    expect(storage.getItem(localStorageWhatsNewSeen)).toBe('8.7.0');
    expect(countUnread(entries, storage)).toBe(0);
  });
});

describe('compareVersions', () => {
  it('compares numerically, not as strings', () => {
    expect(compareVersions('8.10.0', '8.9.0')).toBeGreaterThan(0);
    expect(compareVersions('8.7.0', '8.7.0')).toBe(0);
    expect(compareVersions('8.7', '8.7.1')).toBeLessThan(0);
  });
});

describe('WHATS_NEW', () => {
  it('is ordered newest first', () => {
    for (let i = 1; i < WHATS_NEW.length; i++) {
      expect(compareVersions(WHATS_NEW[i - 1].version, WHATS_NEW[i].version)).toBeGreaterThanOrEqual(0);
      expect(WHATS_NEW[i - 1].date >= WHATS_NEW[i].date).toBe(true);
    }
  });

  it.each(['en', 'fr', 'de', 'es', 'ca', 'lb'])('has every entry translated in %s', (lang) => {
    const file = path.resolve(__dirname, '../../../../../../i18n', lang, 'webapp.json');
    const whatsNew = JSON.parse(readFileSync(file, 'utf-8')).whatsNew;
    for (const key of ['title', 'unread_one', 'unread_other', 'new']) {
      expect(whatsNew[key], `${lang}: whatsNew.${key}`).toBeTruthy();
    }
    for (const entry of WHATS_NEW) {
      const text = whatsNew.entries[entry.id];
      expect(text?.title, `${lang}: ${entry.id}.title`).toBeTruthy();
      expect(text?.body, `${lang}: ${entry.id}.body`).toBeTruthy();
      if (entry.diagramType) expect(text?.action, `${lang}: ${entry.id}.action`).toBeTruthy();
    }
  });
});
