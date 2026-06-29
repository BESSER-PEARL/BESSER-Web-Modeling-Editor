/**
 * Redux slice for the Agent Simulation feature.
 *
 * NOTE: This file provides the full implementation of the agentSimulation Redux slice,
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
 *   limits: AgentSimulationLimits | null
 *   error: string | null
 */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BACKEND_URL } from '@/main/shared/constants/constant';
import type { RootState } from '@/main/app/store/store';

function getAgentSimulationAuthHeaders(base: Record<string, string> = {}): Record<string, string> {
  const githubSession = sessionStorage.getItem('github_session');
  return githubSession
    ? { ...base, 'X-GitHub-Session': githubSession }
    : base;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentSimulationStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'error' | 'system';
  content: string;
  timestamp: string;
}

export interface AgentSimulationLimits {
  memoryMb?: number;
  cpuCores?: number;
  diskMb?: number;
  sessionLifetimeSeconds?: number;
  editorQuotaEnabled?: boolean;
}

export interface StartAgentSimulationPayload {
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

interface AgentSimulationState {
  status: AgentSimulationStatus;
  sessionId: string | null;
  startPayload: StartAgentSimulationPayload | null;
  currentState: string | null;
  lastTransition: string | null;
  messages: Message[];
  stdoutLines: string[];
  eventList: string[];
  limits: AgentSimulationLimits | null;
  error: string | null;
  agentCode: string | null;
  validationErrors: string[];
}

const initialState: AgentSimulationState = {
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

export const startAgentSimulationThunk = createAsyncThunk(
  'agentSimulation/start',
  async (payload: StartAgentSimulationPayload, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/simulation/sessions`, {
        method: 'POST',
        headers: getAgentSimulationAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return rejectWithValue(text || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { sessionId: string; eventList?: string[] };
      return data;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to start agent simulation');
    }
  },
);

export const validateAgentThunk = createAsyncThunk(
  'agentSimulation/validate',
  async (payload: StartAgentSimulationPayload, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/simulation/validate`, {
        method: 'POST',
        headers: getAgentSimulationAuthHeaders({ 'Content-Type': 'application/json' }),
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

export const stopAgentSimulationThunk = createAsyncThunk(
  'agentSimulation/stop',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const sessionId = (state as any).agentSimulation?.sessionId as string | null;
    if (!sessionId) return;

    try {
      await fetch(`${BACKEND_URL}/simulation/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getAgentSimulationAuthHeaders(),
      });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to stop agent simulation');
    }
  },
);

export const resetAgentSimulationThunk = createAsyncThunk(
  'agentSimulation/reset',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const sessionId = (state as any).agentSimulation?.sessionId as string | null;
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
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to reset agent simulation');
    }
  },
);

export const restartAgentSimulationThunk = createAsyncThunk(
  'agentSimulation/restart',
  async (_, { getState, rejectWithValue }) => {
    const agentSimulation = (getState() as any).agentSimulation as AgentSimulationState;
    const payload = agentSimulation?.startPayload;
    if (!payload) return rejectWithValue('No start payload stored — cannot restart');

    // Fire-and-forget cleanup of the current session
    const oldSessionId = agentSimulation.sessionId;
    if (oldSessionId) {
      fetch(`${BACKEND_URL}/test/sessions/${oldSessionId}`, {
        method: 'DELETE',
        headers: getAgentSimulationAuthHeaders(),
      }).catch(() => {});
    }

    try {
      const response = await fetch(`${BACKEND_URL}/simulation/sessions`, {
        method: 'POST',
        headers: getAgentSimulationAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        return rejectWithValue(text || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as { sessionId: string; eventList?: string[] };
      return data;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to restart agent simulation');
    }
  },
);

export const fetchLimitsThunk = createAsyncThunk(
  'agentSimulation/fetchLimits',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/simulation/limits`, {
        headers: getAgentSimulationAuthHeaders(),
      });
      if (!response.ok) return rejectWithValue(`HTTP ${response.status}`);
      return (await response.json()) as AgentSimulationLimits;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch limits');
    }
  },
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const MAX_STDOUT_LINES = 2000;

const agentSimulationSlice = createSlice({
  name: 'agentSimulation',
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
    // startAgentSimulationThunk
    builder
      .addCase(startAgentSimulationThunk.pending, (state, action) => {
        state.status = 'starting';
        state.error = null;
        state.messages = [];
        state.stdoutLines = [];
        state.currentState = null;
        state.lastTransition = null;
        state.sessionId = null;
        state.startPayload = action.meta.arg;
      })
      .addCase(startAgentSimulationThunk.fulfilled, (state, action) => {
        state.status = 'running';
        state.sessionId = action.payload.sessionId;
        state.eventList = action.payload.eventList ?? [];
      })
      .addCase(startAgentSimulationThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = (action.payload as string) ?? 'Failed to start agent simulation';
      });

    // stopAgentSimulationThunk
    builder
      .addCase(stopAgentSimulationThunk.pending, (state) => {
        state.status = 'stopping';
      })
      .addCase(stopAgentSimulationThunk.fulfilled, (state) => {
        state.status = 'idle';
        state.sessionId = null;
      })
      .addCase(stopAgentSimulationThunk.rejected, (state) => {
        state.status = 'idle';
        state.sessionId = null;
      });

    // resetAgentSimulationThunk
    builder
      .addCase(resetAgentSimulationThunk.fulfilled, (state) => {
        state.messages = [];
        state.stdoutLines = [];
        state.currentState = null;
        state.lastTransition = null;
      });

    // restartAgentSimulationThunk — tears down the current session and starts fresh
    // without transitioning through 'idle' (which would navigate away from the test page)
    builder
      .addCase(restartAgentSimulationThunk.pending, (state) => {
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
      .addCase(restartAgentSimulationThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.status = 'running';
        state.sessionId = action.payload.sessionId;
        state.eventList = action.payload.eventList ?? [];
      })
      .addCase(restartAgentSimulationThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = (action.payload as string) ?? 'Failed to restart agent simulation';
      });

    // fetchLimitsThunk
    builder
      .addCase(fetchLimitsThunk.fulfilled, (state, action) => {
        state.limits = action.payload;
      });

    // validateAgentThunk — intentionally does NOT change `status`.
    // Validation is a pre-flight check; the status should stay 'idle' until
    // startAgentSimulationThunk actually creates a session.  Changing status here
    // caused isTestAgentActive to flip true prematurely, which (a) navigated
    // the user to /agent-simulation before they filled in credentials and (b) left
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
} = agentSimulationSlice.actions;

export const agentSimulationReducer = agentSimulationSlice.reducer;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

// Use a local type that includes agentSimulation to avoid circular dependency with store.ts
type AgentSimulationRootState = RootState & { agentSimulation: AgentSimulationState };

const selectAgentSimulation = (state: RootState) => (state as AgentSimulationRootState).agentSimulation;

export const selectAgentSimulationStatus = (state: RootState) => selectAgentSimulation(state).status;
export const selectSessionId = (state: RootState) => selectAgentSimulation(state).sessionId;
export const selectCurrentAgentState = (state: RootState) => selectAgentSimulation(state).currentState;
export const selectLastTransition = (state: RootState) => selectAgentSimulation(state).lastTransition;
export const selectMessages = (state: RootState) => selectAgentSimulation(state).messages;
export const selectStdoutLines = (state: RootState) => selectAgentSimulation(state).stdoutLines;
export const selectEventList = (state: RootState) => selectAgentSimulation(state).eventList;
export const selectAgentSimulationLimits = (state: RootState) => selectAgentSimulation(state).limits;
export const selectAgentSimulationError = (state: RootState) => selectAgentSimulation(state).error;
export const selectIsSimulationRunning = (state: RootState) => {
  const status = selectAgentSimulationStatus(state);
  return status !== 'idle';
};
export const selectAgentCode = (state: RootState) => selectAgentSimulation(state).agentCode;
export const selectValidationErrors = (state: RootState) => selectAgentSimulation(state).validationErrors;
export const selectStartPayload = (state: RootState) => selectAgentSimulation(state).startPayload;

