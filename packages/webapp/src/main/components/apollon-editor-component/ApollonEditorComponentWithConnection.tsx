import { ApollonEditor, ApollonMode, Patch, UMLModel } from '@besser/wme';
import React, { useEffect, useRef, useContext } from 'react';
import styled from 'styled-components';
import { DiagramView } from 'shared';
import { IMessageEvent, w3cwebsocket as W3CWebSocket } from 'websocket';
import { APPLICATION_SERVER_VERSION, DEPLOYMENT_URL, NO_HTTP_URL, WS_PROTOCOL } from '../../constant';
import { DiagramRepository } from '../../services/diagram/diagram-repository';

import { uuid } from '../../utils/uuid';
import { ModalContentType } from '../modals/application-modal-types';
import { selectionDiff } from '../../utils/selection-diff';
import { CollaborationMessage } from '../../utils/collaboration-message-type';

import { selectCreatenewEditor, setCreateNewEditor, updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApollonEditorContext } from './apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateCollaborators } from '../../services/share/shareSlice';
import { showModal } from '../../services/modal/modalSlice';
import { toast } from 'react-toastify';
import { isUMLModel } from '../../types/project';

const ApollonContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  width: 100%;
  height: calc(100vh - 60px);
  background-color: var(--apollon-background, #ffffff);
`;

export const ApollonEditorComponentWithConnection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ApollonEditor | null>(null);
  const clientRef = useRef<W3CWebSocket | null>(null);
  const selectionRef = useRef({ elements: {}, relationships: {} });
  const { token } = useParams();
  const { name: collaborationName, color: collaborationColor } = useAppSelector(
    (state) => state.share.userCollaborationData,
  );
  const dispatch = useAppDispatch();
  const { diagram: reduxDiagram } = useAppSelector((state) => state.diagram);
  const options = useAppSelector((state) => state.diagram.editorOptions);
  const createNewEditor = useAppSelector(selectCreatenewEditor);
  const { setEditor } = useContext(ApollonEditorContext);
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const navigate = useNavigate();

  const selfElementId = document.getElementById(collaborationName + '_' + collaborationColor)!;
  if (selfElementId) selfElementId.style.display = 'none';

  const establishCollaborationConnection = async (token: string, name: string, color: string) => {
    const newClient = new W3CWebSocket(`${WS_PROTOCOL}://${NO_HTTP_URL}`);

    clientRef.current = newClient;

    await new Promise<void>((resolve, reject) => {
      clientRef.current!.onopen = () => {
        resolve();
      };

      clientRef.current!.onerror = (error) => {
        reject(error);
      };
    });
    const collaborators = { name, color };
    clientRef.current!.send(JSON.stringify({ token, collaborators }));

    // Add debouncing for message handling to prevent flickering
    let messageTimeout: NodeJS.Timeout | null = null;
    
    clientRef.current.onmessage = async (message: IMessageEvent) => {
      const { originator, collaborators, diagram, patch, selection } = JSON.parse(message.data as string) as CollaborationMessage;

      const selfElementId = document.getElementById(collaborationName + '_' + collaborationColor)!;
      if (selfElementId) selfElementId.style.display = 'none';

      if (editorRef.current) {
        // Clear any pending updates to prevent rapid successive changes
        if (messageTimeout) {
          clearTimeout(messageTimeout);
        }
        
        // Batch updates with a small delay to prevent flickering
        messageTimeout = setTimeout(() => {
          if (!editorRef.current) return;
          
          // Process updates in order of priority
          if (collaborators) {
            dispatch(updateCollaborators(collaborators));
            editorRef.current.pruneRemoteSelectors(collaborators);
          }
          
          // Handle diagram updates - only update if there's a significant change
          if (diagram?.model && isUMLModel(diagram.model) && editorRef.current) {
            // Check if the model has actually changed to avoid unnecessary updates
            const currentModel = editorRef.current.model;
            if (!currentModel || JSON.stringify(currentModel) !== JSON.stringify(diagram.model)) {
              editorRef.current.model = diagram.model;
            }
          }
          
          // Apply patches with minimal disruption
          if (patch && editorRef.current) {
            editorRef.current.importPatch(patch);
          }
          
          // Handle selection changes last
          if (selection && originator && editorRef.current) {
            editorRef.current.remoteSelect(originator.name, originator.color, selection.selected, selection.deselected);
          }
        }, 16); // ~60fps to smooth out updates
      }
    };

    if (editorRef.current) {
      editorRef.current.subscribeToAllModelChangePatches((patch: Patch) => {
        if (clientRef.current) {
          clientRef.current.send(
            JSON.stringify({
              token,
              collaborator: { name: collaborationName, color: collaborationColor },
              patch,
            }),
          );
        }
      });

      editorRef.current.subscribeToSelectionChange((newSelection) => {
        const diff = selectionDiff(selectionRef.current, newSelection);
        selectionRef.current = newSelection;

        if (clientRef.current && (diff.selected.length > 0 || diff.deselected.length > 0)) {
          clientRef.current.send(
            JSON.stringify({
              token,
              collaborator: { name: collaborationName, color: collaborationColor },
              selection: diff,
            }),
          );
        }
      });
    }
  };

  useEffect(() => {
    const initializeEditor = async () => {
      // Default to COLLABORATE view if no view parameter is specified
      const effectiveView = view || DiagramView.COLLABORATE;
      
      const shouldConnectToServer =
        effectiveView === DiagramView.COLLABORATE || effectiveView === DiagramView.GIVE_FEEDBACK || effectiveView === DiagramView.SEE_FEEDBACK;
      const haveConnectionData = collaborationName && collaborationColor;

      if (shouldConnectToServer && !haveConnectionData) {
        dispatch(setCreateNewEditor(true));
        dispatch(showModal({ type: ModalContentType.CollaborationModal, size: 'lg' }));
        return;
      }

      if (token && APPLICATION_SERVER_VERSION && DEPLOYMENT_URL && containerRef.current && createNewEditor) {
        const editorOptions = structuredClone(options);

        if (effectiveView) {
          switch (effectiveView) {
            case DiagramView.SEE_FEEDBACK:
              editorOptions.mode = ApollonMode.Assessment;
              editorOptions.readonly = true;
              break;
            case DiagramView.GIVE_FEEDBACK:
              editorOptions.mode = ApollonMode.Assessment;
              editorOptions.readonly = false;
              break;
            case DiagramView.EDIT:
              editorOptions.mode = ApollonMode.Modelling;
              editorOptions.readonly = false;
              break;
            case DiagramView.COLLABORATE:
              editorOptions.mode = ApollonMode.Modelling;
              editorOptions.readonly = false;
              break;
          }
        }

        DiagramRepository.getDiagramFromServerByToken(token).then(async (diagram) => {
          if (!diagram) {
            toast.error('Diagram not found');
            navigate('/', { relative: 'path' });
            return;
          }

          if (!isUMLModel(diagram.model)) {
            toast.error('Unsupported diagram data received from server');
            navigate('/', { relative: 'path' });
            return;
          }

          if (editorRef.current) {
            await editorRef.current.nextRender;
            editorRef.current.destroy();
          }
          const editor = new ApollonEditor(containerRef.current!, editorOptions);
          await editor.nextRender;
          editorRef.current = editor;

          await editorRef.current.nextRender;
          editorRef.current.type = diagram.model.type;
          await editorRef.current.nextRender;
          editorRef.current.model = diagram.model;

          editorRef.current.subscribeToModelChange((model: UMLModel) => {
            const diagram = { ...reduxDiagram, model };
            dispatch(updateDiagramThunk(diagram));
          });

          if (shouldConnectToServer) {
            establishCollaborationConnection(token, collaborationName!, collaborationColor!);
          }

          setEditor(editorRef.current);
          dispatch(setCreateNewEditor(false));
        });
      }
    };

    initializeEditor();
  }, [containerRef.current, collaborationName, createNewEditor]);

  useEffect(() => {
    dispatch(setCreateNewEditor(true));
  }, [view]);

  const key = reduxDiagram?.id || uuid();

  return <ApollonContainer key={key} ref={containerRef} />;
};
