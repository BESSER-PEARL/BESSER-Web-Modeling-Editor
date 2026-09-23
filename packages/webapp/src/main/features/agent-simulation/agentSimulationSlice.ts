/**
 * Redux slice for the Agent Simulation feature.
 *
 * State shape:
 *   status: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
 *     — session LIFECYCLE only. Runtime errors reported by the running agent
 *       are routed to the terminal via `reportRuntimeError` and never change it.
 *   sessionId: string | null
 *   startPayload — the NON-SECRET start request, reused by Restart. LLM API keys
 *     live in `agentSimulationCredentialStore`, never in Redux.
 *   currentState / lastTransition — live agent state reported over the WebSocket
 *   stdoutLines, eventList, limits, error (lifecycle error), agentCode, validationErrors
 */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import i18n from '@/main/shared/i18n';
import {
  agentSimulationApi,
  getAgentSimulationErrorMessage,
  type AgentSimulationLimits,
  type AgentSimulationRequest,
  type StartAgentSimulationSessionResponse,
  type ValidateAgentResponse,
} from '@/main/shared/api/agentSimulation';
import { agentSimulationCredentialStore } from './credentialStore';

export type { AgentSimulationLimits } from '@/main/shared/api/agentSimulation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentSimulationStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * Non-secret start payload. Credentials are passed through
 * `agentSimulationCredentialStore` so they never enter Redux actions or state.
 */
export type StartAgentSimulationPayload = AgentSimulationRequest;

export interface AgentSimulationState {
  status: AgentSimulationStatus;
  sessionId: string | null;
  startPayload: StartAgentSimulationPayload | null;
  currentState: string | null;
  lastTransition: string | null;
  stdoutLines: string[];
  eventList: string[];
  limits: AgentSimulationLimits | null;
  error: string | null;
  agentCode: string | null;
  validationErrors: string[];
}

/**
 * Minimal root-state shape the thunks and selectors need. Declared locally
 * (instead of importing `RootState` from the store) to avoid a circular
 * type dependency between the store and this slice.
 */
export interface AgentSimulationRootState {
  agentSimulation: AgentSimulationState;
}

interface ThunkConfig {
  state: AgentSimulationRootState;
  rejectValue: string;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialAgentSimulationState: AgentSimulationState = {
  status: 'idle',
  sessionId: null,
  startPayload: null,
  currentState: null,
  lastTransition: null,
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

function toErrorMessage(error: unknown, fallbackKey: string): string {
  return getAgentSimulationErrorMessage(error, i18n.t(fallbackKey), i18n.t('agentSimulation.errors.timeout'));
}

function startSession(payload: StartAgentSimulationPayload): Promise<StartAgentSimulationSessionResponse> {
  return agentSimulationApi.startSession({ ...payload, credentials: agentSimulationCredentialStore.get() });
}

/**
 * Start a session. Set the credentials with `agentSimulationCredentialStore.set()`
 * before dispatching; the thunk argument itself must stay non-secret.
 */
export const startAgentSimulationThunk = createAsyncThunk<
  StartAgentSimulationSessionResponse,
  StartAgentSimulationPayload,
  ThunkConfig
>('agentSimulation/start', async (payload, { rejectWithValue }) => {
  try {
    return await startSession(payload);
  } catch (err) {
    return rejectWithValue(toErrorMessage(err, 'agentSimulation.errors.startFailed'));
  }
});

export const validateAgentThunk = createAsyncThunk<ValidateAgentResponse, StartAgentSimulationPayload, ThunkConfig>(
  'agentSimulation/validate',
  async (payload, { rejectWithValue }) => {
    try {
      return await agentSimulationApi.validate(payload);
    } catch (err) {
      return rejectWithValue(toErrorMessage(err, 'agentSimulation.errors.validateFailed'));
    }
  },
);

export const stopAgentSimulationThunk = createAsyncThunk<void, void, ThunkConfig>(
  'agentSimulation/stop',
  async (_, { getState, rejectWithValue }) => {
    agentSimulationCredentialStore.clear();
    const { sessionId } = getState().agentSimulation;
    if (!sessionId) return;

    try {
      await agentSimulationApi.stopSession(sessionId);
    } catch (err) {
      return rejectWithValue(toErrorMessage(err, 'agentSimulation.errors.stopFailed'));
    }
  },
);

export const restartAgentSimulationThunk = createAsyncThunk<StartAgentSimulationSessionResponse, void, ThunkConfig>(
  'agentSimulation/restart',
  async (_, { getState, rejectWithValue }) => {
    const { startPayload, sessionId: oldSessionId } = getState().agentSimulation;
    if (!startPayload) return rejectWithValue(i18n.t('agentSimulation.errors.restartUnavailable'));

    // Fire-and-forget cleanup of the current session
    if (oldSessionId) {
      agentSimulationApi.stopSession(oldSessionId).catch(() => {});
    }

    try {
      return await startSession(startPayload);
    } catch (err) {
      return rejectWithValue(toErrorMessage(err, 'agentSimulation.errors.restartFailed'));
    }
  },
);

export const fetchLimitsThunk = createAsyncThunk<AgentSimulationLimits, void, ThunkConfig>(
  'agentSimulation/fetchLimits',
  async (_, { rejectWithValue }) => {
    try {
      return await agentSimulationApi.getLimits();
    } catch (err) {
      return rejectWithValue(toErrorMessage(err, 'agentSimulation.errors.limitsFailed'));
    }
  },
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const MAX_STDOUT_LINES = 2000;

function pushStdoutLine(state: AgentSimulationState, line: string) {
  state.stdoutLines.push(line);
  if (state.stdoutLines.length > MAX_STDOUT_LINES) {
    state.stdoutLines = state.stdoutLines.slice(-MAX_STDOUT_LINES);
  }
}

function clearSessionOutput(state: AgentSimulationState) {
  state.error = null;
  state.stdoutLines = [];
  state.currentState = null;
  state.lastTransition = null;
}

const agentSimulationSlice = createSlice({
  name: 'agentSimulation',
  initialState: initialAgentSimulationState,
  reducers: {
    /** Lifecycle error: the session is unusable (e.g. WebSocket auth rejected). */
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'error';
      }
    },
    /** Runtime error reported by the running agent — shown in the terminal, lifecycle untouched. */
    reportRuntimeError(state, action: PayloadAction<string>) {
      pushStdoutLine(state, `[error] ${action.payload}`);
    },
    appendStdoutLine(state, action: PayloadAction<string>) {
      pushStdoutLine(state, action.payload);
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
  },
  extraReducers: (builder) => {
    // startAgentSimulationThunk
    builder
      .addCase(startAgentSimulationThunk.pending, (state, action) => {
        state.status = 'starting';
        clearSessionOutput(state);
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
        state.error = action.payload ?? i18n.t('agentSimulation.errors.startFailed');
      });

    // stopAgentSimulationThunk
    builder
      .addCase(stopAgentSimulationThunk.pending, (state) => {
        state.status = 'stopping';
      })
      .addCase(stopAgentSimulationThunk.fulfilled, (state) => {
        state.status = 'idle';
        state.sessionId = null;
        state.startPayload = null;
      })
      .addCase(stopAgentSimulationThunk.rejected, (state) => {
        state.status = 'idle';
        state.sessionId = null;
        state.startPayload = null;
      });

    // restartAgentSimulationThunk — tears down the current session and starts fresh
    // without transitioning through 'idle' (which would navigate away from the test page).
    // `sessionId` is deliberately kept while pending: the thunk body (which runs after
    // this reducer) reads it to delete the old session; `fulfilled` replaces it.
    builder
      .addCase(restartAgentSimulationThunk.pending, (state) => {
        state.status = 'starting';
        clearSessionOutput(state);
        state.validationErrors = [];
        state.eventList = [];
      })
      .addCase(restartAgentSimulationThunk.fulfilled, (state, action) => {
        state.status = 'running';
        state.sessionId = action.payload.sessionId;
        state.eventList = action.payload.eventList ?? [];
      })
      .addCase(restartAgentSimulationThunk.rejected, (state, action) => {
        state.status = 'error';
        state.sessionId = null;
        state.error = action.payload ?? i18n.t('agentSimulation.errors.restartFailed');
      });

    // fetchLimitsThunk
    builder.addCase(fetchLimitsThunk.fulfilled, (state, action) => {
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
        state.agentCode = action.payload.agentCode;
        if (!action.payload.valid) {
          state.validationErrors = action.payload.errors;
        } else {
          state.eventList = action.payload.eventList;
        }
      })
      .addCase(validateAgentThunk.rejected, (state, action) => {
        state.validationErrors = [action.payload ?? i18n.t('agentSimulation.errors.validateFailed')];
      });
  },
});

export const {
  setError,
  reportRuntimeError,
  appendStdoutLine,
  setCurrentAgentState,
  setLastTransition,
  setEventList,
} = agentSimulationSlice.actions;

export const agentSimulationReducer = agentSimulationSlice.reducer;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const selectAgentSimulation = (state: AgentSimulationRootState) => state.agentSimulation;

export const selectAgentSimulationStatus = (state: AgentSimulationRootState) => selectAgentSimulation(state).status;
export const selectSessionId = (state: AgentSimulationRootState) => selectAgentSimulation(state).sessionId;
export const selectCurrentAgentState = (state: AgentSimulationRootState) => selectAgentSimulation(state).currentState;
export const selectLastTransition = (state: AgentSimulationRootState) => selectAgentSimulation(state).lastTransition;
export const selectStdoutLines = (state: AgentSimulationRootState) => selectAgentSimulation(state).stdoutLines;
export const selectEventList = (state: AgentSimulationRootState) => selectAgentSimulation(state).eventList;
export const selectAgentSimulationLimits = (state: AgentSimulationRootState) => selectAgentSimulation(state).limits;
export const selectAgentSimulationError = (state: AgentSimulationRootState) => selectAgentSimulation(state).error;
export const selectIsSimulationRunning = (state: AgentSimulationRootState) => {
  const status = selectAgentSimulationStatus(state);
  return status !== 'idle';
};
export const selectAgentCode = (state: AgentSimulationRootState) => selectAgentSimulation(state).agentCode;
export const selectValidationErrors = (state: AgentSimulationRootState) => selectAgentSimulation(state).validationErrors;
export const selectStartPayload = (state: AgentSimulationRootState) => selectAgentSimulation(state).startPayload;
