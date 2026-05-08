// Tiny session-scoped hook for the user's OpenAI API key.
//
// The KG cleanup feature lets the user paste their key once per session
// instead of re-entering it every time. We deliberately use sessionStorage
// (cleared when the tab closes) rather than localStorage to avoid leaving
// the key on disk for longer than necessary.
//
// Existing AI features (image-to-model, KG-to-BUML import) keep their own
// inline inputs unchanged — they can opt in to this hook when convenient.
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'besser.openai.api_key';

function readKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeKey(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage is unavailable in some sandboxed contexts; ignore.
  }
}

export const useOpenAIApiKey = () => {
  const [apiKey, setApiKeyState] = useState<string>(readKey);

  // Sync across tabs/windows that share the same sessionStorage scope.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setApiKeyState(event.newValue || '');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setApiKey = useCallback((value: string) => {
    const trimmed = (value || '').trim();
    writeKey(trimmed);
    setApiKeyState(trimmed);
  }, []);

  const clearApiKey = useCallback(() => {
    writeKey('');
    setApiKeyState('');
  }, []);

  return { apiKey, setApiKey, clearApiKey };
};
