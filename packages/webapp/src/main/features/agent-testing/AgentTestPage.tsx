import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/main/app/store/hooks';
import { selectActiveDiagram } from '@/main/app/store/workspaceSlice';
import { AgentTestPanel } from './AgentTestPanel';
import { selectAgentTestStatus, selectSessionId, stopAgentTestThunk } from './agentTestSlice';

export const AgentTestPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAgentTestStatus);
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
  // dispatching with no session causes stopAgentTestThunk.pending to briefly
  // set status to 'stopping', which flips isTestAgentActive true→false→true
  // and triggers an infinite /test-agent ↔ / navigation loop.
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        dispatch(stopAgentTestThunk());
      }
    };
  }, [dispatch]);

  if (status === 'idle') return null;

  return <AgentTestPanel open diagramTitle={diagram?.title ?? 'Agent'} />;
};
