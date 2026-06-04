/**
 * Redux slice for the Agent Test feature.
 *
 * NOTE: This file provides the full implementation of the agentTest Redux slice,
 * including state shape, thunks, selectors, and the WebSocket session hook.
 *
 * State shape:
 *   status: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
 *   sessionId: string | null
 *   currentState: string | null  — name of the active agent state
 *   lastTransition: string | null
 *   messages: Message[]
 *   stdoutLines: string[]
 *   eventList: string[]
 *   limits: AgentTestLimits | null
 *   error: string | null
 */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BACKEND_URL } from '@/main/shared/constants/constant';
import type { RootState } from '@/main/app/store/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentTestStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'error' | 'system';
  content: string;
  timestamp: string;
}

export interface AgentTestLimits {
  memoryMb?: number;
  cpuCores?: number;
  diskMb?: number;
  sessionLifetimeSeconds?: number;
  editorQuotaEnabled?: boolean;
}

export interface StartAgentTestPayload {
  title: string;
  model: object;
  config?: object;
  configYaml?: string;
  credentials?: {
    openAiApiKey?: string;
    huggingFaceToken?: string;
    replicateApiKey?: string;
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

interface AgentTestState {
  status: AgentTestStatus;
  sessionId: string | null;
  startPayload: StartAgentTestPayload | null;
  currentState: string | null;
  lastTransition: string | null;
  messages: Message[];
  stdoutLines: string[];
  eventList: string[];
  limits: AgentTestLimits | null;
  error: string | null;
  agentCode: string | null;
  validationErrors: string[];
}

const initialState: AgentTestState = {
  status: 'idle',
  sessionId: null,
  startPayload: null,
  currentState: null,
  lastTransition: null,
  messages: [],
  stdoutLines: [],
  eventList: [],
  limits: null,
  error: null,
  agentCode: null,
  validationErrors: [],
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const startAgentTestThunk = createAsyncThunk(
  'agentTest/start',
  async (payload: StartAgentTestPayload, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/test/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return rejectWithValue(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { sessionId: string; eventList?: string[] };
      return data;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to start agent test');
    }
  },
);

export const validateAgentThunk = createAsyncThunk(
  'agentTest/validate',
  async (payload: StartAgentTestPayload, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/test/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return rejectWithValue(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        valid: boolean;
        agentCode: string;
        eventList: string[];
        errors: string[];
      };
      return data;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to validate agent');
    }
  },
);

export const stopAgentTestThunk = createAsyncThunk(
  'agentTest/stop',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const sessionId = (state as any).agentTest?.sessionId as string | null;
    if (!sessionId) return;

    try {
      await fetch(`${BACKEND_URL}/test/sessions/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to stop agent test');
    }
  },
);

export const resetAgentTestThunk = createAsyncThunk(
  'agentTest/reset',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const sessionId = (state as any).agentTest?.sessionId as string | null;
    if (!sessionId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/test/sessions/${sessionId}/reset`, {
        method: 'POST',
      });

      if (!response.ok) {
        const text = await response.text();
        return rejectWithValue(text || `HTTP ${response.status}`);
      }
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to reset agent test');
    }
  },
);

export const restartAgentTestThunk = createAsyncThunk(
  'agentTest/restart',
  async (_, { getState, rejectWithValue }) => {
    const agentTest = (getState() as any).agentTest as AgentTestState;
    const payload = agentTest?.startPayload;
    if (!payload) return rejectWithValue('No start payload stored — cannot restart');

    // Fire-and-forget cleanup of the current session
    const oldSessionId = agentTest.sessionId;
    if (oldSessionId) {
      fetch(`${BACKEND_URL}/test/sessions/${oldSessionId}`, { method: 'DELETE' }).catch(() => {});
    }

    try {
      const response = await fetch(`${BACKEND_URL}/test/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        return rejectWithValue(text || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as { sessionId: string; eventList?: string[] };
      return data;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to restart agent test');
    }
  },
);

export const fetchLimitsThunk = createAsyncThunk(
  'agentTest/fetchLimits',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/test/limits`);
      if (!response.ok) return rejectWithValue(`HTTP ${response.status}`);
      return (await response.json()) as AgentTestLimits;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch limits');
    }
  },
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const MAX_STDOUT_LINES = 2000;

const agentTestSlice = createSlice({
  name: 'agentTest',
  initialState,
  reducers: {
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'error';
      }
    },
    addMessage(state, action: PayloadAction<Omit<Message, 'id' | 'timestamp'>>) {
      state.messages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
        ...action.payload,
      });
    },
    appendStdoutLine(state, action: PayloadAction<string>) {
      state.stdoutLines.push(action.payload);
      if (state.stdoutLines.length > MAX_STDOUT_LINES) {
        state.stdoutLines = state.stdoutLines.slice(-MAX_STDOUT_LINES);
      }
    },
    setCurrentAgentState(state, action: PayloadAction<string>) {
      state.currentState = action.payload;
    },
    setLastTransition(state, action: PayloadAction<string>) {
      state.lastTransition = action.payload;
    },
    setEventList(state, action: PayloadAction<string[]>) {
      state.eventList = action.payload;
    },
    resetSession(state) {
      state.messages = [];
      state.stdoutLines = [];
      state.currentState = null;
      state.lastTransition = null;
    },
  },
  extraReducers: (builder) => {
    // startAgentTestThunk
    builder
      .addCase(startAgentTestThunk.pending, (state, action) => {
        state.status = 'starting';
        state.error = null;
        state.messages = [];
        state.stdoutLines = [];
        state.currentState = null;
        state.lastTransition = null;
        state.sessionId = null;
        state.startPayload = action.meta.arg;
      })
      .addCase(startAgentTestThunk.fulfilled, (state, action) => {
        state.status = 'running';
        state.sessionId = action.payload.sessionId;
        state.eventList = action.payload.eventList ?? [];
      })
      .addCase(startAgentTestThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = (action.payload as string) ?? 'Failed to start agent test';
      });

    // stopAgentTestThunk
    builder
      .addCase(stopAgentTestThunk.pending, (state) => {
        state.status = 'stopping';
      })
      .addCase(stopAgentTestThunk.fulfilled, (state) => {
        state.status = 'idle';
        state.sessionId = null;
      })
      .addCase(stopAgentTestThunk.rejected, (state) => {
        state.status = 'idle';
        state.sessionId = null;
      });

    // resetAgentTestThunk
    builder
      .addCase(resetAgentTestThunk.fulfilled, (state) => {
        state.messages = [];
        state.stdoutLines = [];
        state.currentState = null;
        state.lastTransition = null;
      });

    // restartAgentTestThunk — tears down the current session and starts fresh
    // without transitioning through 'idle' (which would navigate away from the test page)
    builder
      .addCase(restartAgentTestThunk.pending, (state) => {
        state.status = 'starting';
        state.error = null;
        state.messages = [];
        state.stdoutLines = [];
        state.currentState = null;
        state.lastTransition = null;
        state.sessionId = null;
        state.validationErrors = [];
        state.eventList = [];
      })
      .addCase(restartAgentTestThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.status = 'running';
        state.sessionId = action.payload.sessionId;
        state.eventList = action.payload.eventList ?? [];
      })
      .addCase(restartAgentTestThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = (action.payload as string) ?? 'Failed to restart agent test';
      });

    // fetchLimitsThunk
    builder
      .addCase(fetchLimitsThunk.fulfilled, (state, action) => {
        state.limits = action.payload;
      });

    // validateAgentThunk — intentionally does NOT change `status`.
    // Validation is a pre-flight check; the status should stay 'idle' until
    // startAgentTestThunk actually creates a session.  Changing status here
    // caused isTestAgentActive to flip true prematurely, which (a) navigated
    // the user to /test-agent before they filled in credentials and (b) left
    // status stuck in a non-idle value whenever the user cancelled the dialog
    // or navigated away, breaking all subsequent Test Agent clicks.
    builder
      .addCase(validateAgentThunk.pending, (state) => {
        state.agentCode = null;
        state.validationErrors = [];
      })
      .addCase(validateAgentThunk.fulfilled, (state, action) => {
        if (!action.payload.valid) {
          state.validationErrors = action.payload.errors;
          state.agentCode = action.payload.agentCode;
        } else {
          state.agentCode = action.payload.agentCode;
          state.eventList = action.payload.eventList;
        }
      })
      .addCase(validateAgentThunk.rejected, (state, action) => {
        state.validationErrors = [(action.payload as string) ?? 'Failed to validate agent'];
      });
  },
});

export const {
  setError,
  addMessage,
  appendStdoutLine,
  setCurrentAgentState,
  setLastTransition,
  setEventList,
  resetSession,
} = agentTestSlice.actions;

export const agentTestReducer = agentTestSlice.reducer;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

// Use a local type that includes agentTest to avoid circular dependency with store.ts
type AgentTestRootState = RootState & { agentTest: AgentTestState };

const selectAgentTest = (state: RootState) => (state as AgentTestRootState).agentTest;

export const selectAgentTestStatus = (state: RootState) => selectAgentTest(state).status;
export const selectSessionId = (state: RootState) => selectAgentTest(state).sessionId;
export const selectCurrentAgentState = (state: RootState) => selectAgentTest(state).currentState;
export const selectLastTransition = (state: RootState) => selectAgentTest(state).lastTransition;
export const selectMessages = (state: RootState) => selectAgentTest(state).messages;
export const selectStdoutLines = (state: RootState) => selectAgentTest(state).stdoutLines;
export const selectEventList = (state: RootState) => selectAgentTest(state).eventList;
export const selectAgentTestLimits = (state: RootState) => selectAgentTest(state).limits;
export const selectAgentTestError = (state: RootState) => selectAgentTest(state).error;
export const selectIsTestAgentRunning = (state: RootState) => {
  const status = selectAgentTestStatus(state);
  return status !== 'idle';
};
export const selectAgentCode = (state: RootState) => selectAgentTest(state).agentCode;
export const selectValidationErrors = (state: RootState) => selectAgentTest(state).validationErrors;
export const selectStartPayload = (state: RootState) => selectAgentTest(state).startPayload;

