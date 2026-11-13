/**
 * The assistant conversation belongs to the project, not to the browser tab.
 * Reported 2026-11-09: the class diagram showed up in every window, but only
 * the window that built it had the conversation; describing the app anywhere
 * else started a new dialogue.
 *
 * Each "tab" here is a fresh copy of the app modules (vi.resetModules) with its
 * own Redux store and assistant client, sharing one localStorage the way the
 * tabs of one browser do. Writes to localStorage are replayed as `storage`
 * events, which the browser fires in the other tabs.
 */

import React from 'react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { ChatMessage, SendStatus } from '../../services/assistant-types';
import { createDefaultProject, type BesserProject } from '../../../../shared/types/project';
import { writeLlmKey } from '../../../../shared/services/llmKeyStorage';
import { PROJECT_CONVERSATION_WRITE_DEBOUNCE_MS } from '../useAssistantLogic';

interface FakeClient {
  messageHandlers: Array<(m: ChatMessage) => void>;
  sentMessages: string[];
  historyRequests: number;
  restarts: number;
}

// Each tab loads the app modules afresh and some wait out the 1.5 s project write,
// which runs past the 5 s default when the whole suite loads the machine.
vi.setConfig({ testTimeout: 20_000 });

/** The assistant's rate limiter refuses a second message within 1 s. */
const RATE_LIMIT_COOLDOWN_MS = 1_700;

const _tabs = vi.hoisted(() => ({ clients: [] as FakeClient[] }));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient implements FakeClient {
    messageHandlers: Array<(m: ChatMessage) => void> = [];
    sentMessages: string[] = [];
    historyRequests = 0;
    restarts = 0;
    onMessage(handler: (m: ChatMessage) => void) {
      this.messageHandlers.push(handler);
      return () => {
        this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
      };
    }
    onInjection() {
      return noopUnsub;
    }
    onConnection() {
      return noopUnsub;
    }
    onTyping() {
      return noopUnsub;
    }
    onAction() {
      return noopUnsub;
    }
    clearHandlers() {}
    connect() {
      return Promise.resolve();
    }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    setHistoryProvider() {}
    sendHistoryWithNextMessage() {
      this.historyRequests += 1;
    }
    restartWithHistoryOnNextMessage() {
      this.restarts += 1;
    }
    sendMessage(text: string): SendStatus {
      this.sentMessages.push(text);
      return 'sent';
    }
    sendVoiceMessage(): SendStatus {
      return 'sent';
    }
    sendFrontendEvent(): SendStatus {
      return 'sent';
    }
    get connected() {
      return true;
    }
    get connectionState() {
      return 'connected';
    }
  }
  // The mocked module survives vi.resetModules, so a client is made per mount:
  // each tab mounts one surface, which asks for the client once.
  const getSharedAssistantClient = () => {
    const tabClient = new FakeAssistantClient();
    _tabs.clients.push(tabClient);
    return tabClient;
  };
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient };
});

vi.mock('../useModelInjection', () => ({
  useModelInjection: () => ({
    handleInjection: async () => {},
    ensureTargetDiagramReady: async () => true,
    handleUndo: () => {},
    undoAvailable: false,
    refreshUndoState: () => {},
  }),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/events', () => ({
  track: vi.fn(),
  errorProperties: () => ({ error_type: 'Error', network_error: false }),
}));

interface Tab {
  client: FakeClient;
  messages: () => ChatKitMessage[];
  setMessages: (update: (prev: ChatKitMessage[]) => ChatKitMessage[]) => void;
  submit: (text: string) => Promise<void>;
  newChat: () => void;
  reply: (text: string) => void;
  project: () => BesserProject | null;
}

/** Open the project in a new tab: fresh app modules, the shared localStorage. */
async function openTab(projectId: string): Promise<Tab> {
  vi.resetModules();
  const [
    { useAssistantLogic },
    { conversationStore },
    { workspaceReducer },
    { errorReducer },
    { specDrivenReducer },
    { BesserEditorProvider },
    { ProjectStorageRepository },
  ] = await Promise.all([
    import('../useAssistantLogic'),
    import('../assistantConversationStore'),
    import('../../../../app/store/workspaceSlice'),
    import('../../../../app/store/errorManagementSlice'),
    import('../../../../features/spec-driven'),
    import('../../../editors'),
    import('../../../../shared/services/storage/ProjectStorageRepository'),
  ]);
  const project = ProjectStorageRepository.loadProject(projectId);
  const workspace = { ...workspaceReducer(undefined, { type: 'init' }), project };
  const reducer = combineReducers({ workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer });
  const store = configureStore({ reducer, preloadedState: { workspace } });
  const api: { current: ReturnType<typeof useAssistantLogic> | null } = { current: null };
  function Surface() {
    api.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
    return null;
  }
  render(
    <Provider store={store}>
      <BesserEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Surface />
      </BesserEditorProvider>
    </Provider>,
  );
  const client = _tabs.clients[_tabs.clients.length - 1];
  await waitFor(() => expect(api.current).not.toBeNull());
  return {
    client,
    messages: () => conversationStore.getMessages(),
    setMessages: (update) => act(() => conversationStore.setMessages(update)),
    submit: async (text) => {
      await act(async () => {
        await api.current!.handleSubmit(undefined, { overrideText: text });
      });
    },
    newChat: () => act(() => api.current!.clearConversation()),
    reply: (text) =>
      act(() => {
        const msg = { id: `m_${Math.random()}`, action: 'assistant_message', message: text, timestamp: new Date() };
        client.messageHandlers.forEach((h) => h(msg as ChatMessage));
      }),
    project: () => store.getState().workspace.project,
  };
}

/** A reload or a closed tab: the page is gone, its sessionStorage may stay. */
function leaveTab({ keepSessionStorage }: { keepSessionStorage: boolean }) {
  act(() => {
    window.dispatchEvent(new Event('pagehide'));
  });
  cleanup();
  if (!keepSessionStorage) sessionStorage.clear();
}

const contents = (tab: Tab) => tab.messages().map((m) => m.content);

const runCard = (): ChatKitMessage => ({
  id: 'run-card-1',
  role: 'assistant',
  content: '',
  createdAt: new Date(),
  specDriven: { status: 'done', phases: [], warnings: [], text: 'Library app ready', runId: 'run_0123456789abcdef' },
});

function saveProject(name: string): string {
  const project = createDefaultProject(name, '', '');
  localStorage.setItem(`besser_project_${project.id}`, JSON.stringify(project));
  return project.id;
}

// The browser fires `storage` in the OTHER tabs after a localStorage write; here
// every tab shares one window, so the writer sees its own write too.
let restoreStorage: (() => void) | null = null;
function replayStorageWritesAsEvents() {
  // The test setup installs its own localStorage object (src/test/storage-shim.ts).
  const storage = globalThis.localStorage;
  const setItem = storage.setItem;
  const removeItem = storage.removeItem;
  const fire = (key: string, oldValue: string | null, newValue: string | null) =>
    setTimeout(() => act(() => void window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue }))), 0);
  storage.setItem = (key: string, value: string) => {
    const old = storage.getItem(key);
    setItem.call(storage, key, value);
    fire(key, old, value);
  };
  storage.removeItem = (key: string) => {
    const old = storage.getItem(key);
    removeItem.call(storage, key);
    if (old !== null) fire(key, old, null);
  };
  restoreStorage = () => {
    storage.setItem = setItem;
    storage.removeItem = removeItem;
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  _tabs.clients.length = 0;
});

afterEach(() => {
  restoreStorage?.();
  restoreStorage = null;
  cleanup();
  vi.clearAllMocks();
});

describe('the assistant conversation belongs to the project', () => {
  it('a second tab opening the project shows the earlier conversation, run card included', async () => {
    const projectId = saveProject('Library');
    const first = await openTab(projectId);
    await first.submit('A library app with books and loans');
    first.reply('Created Book and Loan.');
    // An agent reply is queued behind injections, so it shows up asynchronously.
    await waitFor(() => expect(contents(first)).toContain('Created Book and Loan.'));
    first.setMessages((prev) => [...prev, runCard()]);
    // The text copy on the project is written too (it travels with GitHub).
    await waitFor(() => expect(first.project()?.assistantConversation?.turns).toHaveLength(2), { timeout: 4000 });
    leaveTab({ keepSessionStorage: false });

    const second = await openTab(projectId);
    await waitFor(() =>
      expect(contents(second)).toEqual(['A library app with books and loans', 'Created Book and Loan.', '']),
    );
    expect(second.messages()[2].specDriven).toMatchObject({ status: 'done', runId: 'run_0123456789abcdef' });
    // The agent's session in this tab is new: it gets the history.
    expect(second.client.historyRequests).toBe(1);
  });

  it('a tab already open on the project picks up turns added in another tab, and the agent gets them', async () => {
    replayStorageWritesAsEvents();
    const projectId = saveProject('Library');
    const a = await openTab(projectId);
    const b = await openTab(projectId);

    await a.submit('A library app with books and loans');
    a.reply('Created Book and Loan.');
    await waitFor(() => expect(contents(b)).toEqual(['A library app with books and loans', 'Created Book and Loan.']));
    expect(b.client.restarts).toBe(1);

    await b.submit('Add a Member class');
    await waitFor(() =>
      expect(contents(a)).toEqual([
        'A library app with books and loans',
        'Created Book and Loan.',
        'Add a Member class',
      ]),
    );
    // Neither tab drops the other's turns from the project's text copy.
    await waitFor(() => expect(a.project()?.assistantConversation?.turns).toHaveLength(3), { timeout: 4000 });
    expect(JSON.parse(localStorage.getItem(`besser_project_${projectId}`)!).assistantConversation.turns).toHaveLength(
      3,
    );
  });

  it('a new chat in one tab clears the other tab too', async () => {
    replayStorageWritesAsEvents();
    const projectId = saveProject('Library');
    const a = await openTab(projectId);
    const b = await openTab(projectId);
    await a.submit('A library app');
    await waitFor(() => expect(contents(b)).toEqual(['A library app']));

    const restartsBefore = b.client.restarts;

    a.newChat();
    await waitFor(() => expect(b.messages()).toEqual([]));
    // B's agent session held the old conversation: its next message starts a new one.
    expect(b.client.restarts).toBeGreaterThan(restartsBefore);
  });

  it("a new chat and its first message, saved together, replace the other tab's conversation", async () => {
    replayStorageWritesAsEvents();
    const projectId = saveProject('Library');
    const a = await openTab(projectId);
    const b = await openTab(projectId);
    await a.submit('A library app');
    a.reply('Created Book.');
    await waitFor(() => expect(contents(b)).toEqual(['A library app', 'Created Book.']));
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_COOLDOWN_MS));

    // Both land in one write (within the 400 ms debounce): only the new
    // conversation id tells B that the old turns are gone.
    a.newChat();
    await a.submit('A shop app');
    await waitFor(() => expect(contents(b)).toEqual(['A shop app']));
  });

  it('keeps the BYOK key out of the conversation kept in localStorage', async () => {
    const key = 'sk-test-0123456789abcdefghijklmn';
    writeLlmKey('openai', key);
    const projectId = saveProject('Library');
    const tab = await openTab(projectId);
    await tab.submit(`my key is ${key}, use it`);
    tab.reply(`Saved ${key} for this session.`);
    const stored = () => localStorage.getItem(`besser_assistant_conversation_v2_${projectId}`) ?? '';
    await waitFor(() => expect(stored()).toContain('[API key removed]'));
    expect(stored()).not.toContain(key);
  });

  it('a conversation evicted or removed elsewhere stays on screen in a tab showing it', async () => {
    replayStorageWritesAsEvents();
    const projectId = saveProject('Library');
    const tab = await openTab(projectId);
    await tab.submit('A library app');
    tab.reply('Created Book.');
    const key = `besser_assistant_conversation_v2_${projectId}`;
    await waitFor(() => expect(localStorage.getItem(key)).not.toBeNull());

    localStorage.removeItem(key);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(contents(tab)).toEqual(['A library app', 'Created Book.']);
  });

  it("a reload that opens a different project does not show the previous project's chat", async () => {
    const library = saveProject('Library');
    const shop = saveProject('Shop');
    const tab = await openTab(library);
    await tab.submit('A library app with books and loans');
    tab.reply('Created Book and Loan.');
    // Another tab opened the shop meanwhile, so the reload loads the shop.
    leaveTab({ keepSessionStorage: true });

    const reloaded = await openTab(shop);
    // Past the debounced write to the project's text copy.
    await new Promise((resolve) => setTimeout(resolve, PROJECT_CONVERSATION_WRITE_DEBOUNCE_MS + 500));
    expect(reloaded.messages()).toEqual([]);
    expect(reloaded.project()?.assistantConversation).toBeUndefined();

    // Back on the library, its conversation is still there.
    leaveTab({ keepSessionStorage: true });
    const back = await openTab(library);
    await waitFor(() =>
      expect(contents(back)).toEqual(['A library app with books and loans', 'Created Book and Loan.']),
    );
  });
});

describe('moving the per-tab conversation kept before v8.9.3', () => {
  const legacyCopy = (contents: string[], savedAt = Date.now()) =>
    JSON.stringify({
      savedAt,
      messages: contents.map((content, i) => ({
        id: `legacy-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content,
        createdAt: new Date(Date.now() + i).toISOString(),
      })),
      messageMeta: {},
    });

  it('moves it to the project the tab opens when that project has no conversation yet', async () => {
    const projectId = saveProject('Library');
    sessionStorage.setItem('besser_assistant_conversation_v1', legacyCopy(['A library app', 'Created Book.']));

    const tab = await openTab(projectId);
    await waitFor(() => expect(contents(tab)).toEqual(['A library app', 'Created Book.']));
    expect(sessionStorage.getItem('besser_assistant_conversation_v1')).toBeNull();
    await waitFor(() =>
      expect(localStorage.getItem(`besser_assistant_conversation_v2_${projectId}`)).toContain('Created Book.'),
    );
  });

  it('leaves a copy older than 48 hours where it is, so nothing moves', async () => {
    const projectId = saveProject('Library');
    const hours49 = 49 * 60 * 60 * 1000;
    sessionStorage.setItem('besser_assistant_conversation_v1', legacyCopy(['A library app'], Date.now() - hours49));

    const tab = await openTab(projectId);
    await new Promise((resolve) => setTimeout(resolve, PROJECT_CONVERSATION_WRITE_DEBOUNCE_MS + 500));
    expect(tab.messages()).toEqual([]);
    expect(localStorage.getItem(`besser_assistant_conversation_v2_${projectId}`)).toBeNull();
    expect(sessionStorage.getItem('besser_assistant_conversation_v1')).toBeNull();
  });

  it("drops it when the project's own conversation is a different one", async () => {
    const project = createDefaultProject('Shop', '', '');
    project.assistantConversation = {
      turns: [{ role: 'user', content: 'A shop with products' }],
      updatedAt: '2026-11-08T00:00:00Z',
    };
    localStorage.setItem(`besser_project_${project.id}`, JSON.stringify(project));
    sessionStorage.setItem('besser_assistant_conversation_v1', legacyCopy(['A library app', 'Created Book.']));

    const tab = await openTab(project.id);
    await waitFor(() => expect(contents(tab)).toEqual(['A shop with products']));
    expect(sessionStorage.getItem('besser_assistant_conversation_v1')).toBeNull();
  });
});
