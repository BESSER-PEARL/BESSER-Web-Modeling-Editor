import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/main/app/store/hooks';
import { selectActiveDiagram } from '@/main/app/store/workspaceSlice';
import { AgentSimulationPanel } from './AgentSimulationPanel';
import { selectAgentSimulationStatus, selectSessionId, stopAgentSimulationThunk } from './agentSimulationSlice';

export const AgentSimulationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAgentSimulationStatus);
  const sessionId = useAppSelector(selectSessionId);
  const diagram = useAppSelector(selectActiveDiagram);

  // Keep a ref so the unmount cleanup always sees the latest sessionId without
  // needing it in the dependency array (which would re-register on every change).
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Navigate back to editor when the session stops (status becomes idle).
  useEffect(() => {
    if (status === 'idle') {
      navigate('/');
    }
  }, [status, navigate]);

  // Stop the session when the user navigates away from this page without
  // explicitly clicking Stop.  Only dispatch when there is a live session —
  // dispatching with no session causes stopAgentSimulationThunk.pending to briefly
  // set status to 'stopping', which flips isSimulationRunning true→false→true
  // and triggers an infinite /agent-simulation ↔ / navigation loop.
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        dispatch(stopAgentSimulationThunk());
      }
    };
  }, [dispatch]);

  if (status === 'idle') return null;

  return <AgentSimulationPanel open diagramTitle={diagram?.title ?? t('agentSimulation.defaultDiagramTitle')} />;
};
