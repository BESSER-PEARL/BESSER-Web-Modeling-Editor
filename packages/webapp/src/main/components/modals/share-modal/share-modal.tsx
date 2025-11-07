import React from 'react';
import { Button, FormControl, InputGroup, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { DiagramRepository } from '../../../services/diagram/diagram-repository';
import { DEPLOYMENT_URL } from '../../../constant';
import { DiagramView } from 'shared';
import { ModalContentProps } from '../application-modal-types';
import { LocalStorageRepository } from '../../../services/local-storage/local-storage-repository';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { InfoCircle } from 'react-bootstrap-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { displayError } from '../../../services/error-management/errorManagementSlice';
import { useNavigate } from 'react-router-dom';
import {
  setCreateNewEditor,
  setDisplayUnpublishedVersion,
  updateDiagramThunk,
} from '../../../services/diagram/diagramSlice';
import { selectDisplaySidebar, toggleSidebar } from '../../../services/version-management/versionManagementSlice';
import { isUMLModel } from '../../../types/project';

export const ShareModal: React.FC<ModalContentProps> = ({ close }) => {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector((state) => state.diagram.diagram);
  const navigate = useNavigate();
  const isSidebarDisplayed = useAppSelector(selectDisplaySidebar);
  const urlPath = window.location.pathname;
  const tokenInUrl = urlPath.substring(1); // This removes the leading "/"

  const getLinkForView = (token?: string) => {
    if (LocalStorageRepository.getLastPublishedType() === DiagramView.EMBED) {
      return `![${
        diagram ? diagram.title : 'Diagram'
      }](${DEPLOYMENT_URL}/api/diagrams/${LocalStorageRepository.getLastPublishedToken()}?type=svg)`;
    }

    return `${DEPLOYMENT_URL}/${token || LocalStorageRepository.getLastPublishedToken()}?view=${LocalStorageRepository.getLastPublishedType()}`;
  };

  const getMessageForView = (view: string) => {
    switch (view) {
      case DiagramView.GIVE_FEEDBACK:
        return 'give feedback';

      case DiagramView.SEE_FEEDBACK:
        return 'see feedback';

      case DiagramView.COLLABORATE:
        return 'collaborate';

      case DiagramView.EMBED:
        return 'embed';

      case DiagramView.EDIT:
        return 'edit';
    }
    return 'collaborate'; //edit
  };

  const fallbackCopyToClipboard = (text: string) => { //new fix
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const copyLink = (view?: DiagramView, token?: string) => {
    const link = getLinkForView(token);
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link);
      } else {
        fallbackCopyToClipboard(link);
      }
      const lastPublishedTypeLocalStorage = LocalStorageRepository.getLastPublishedType();
      const viewUsedInMessage = view
        ? getMessageForView(view)
        : getMessageForView(lastPublishedTypeLocalStorage || DiagramView.COLLABORATE); //maybe put edit as default

      toast.success(
        'The link has been copied to your clipboard and can be shared to ' +
          viewUsedInMessage +
          ', simply by pasting the link. You can re-access the link by going to share menu.',
        {
          autoClose: 10000,
        },
      );
      // Navigate to the generated link
      window.location.href = link;

    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy to clipboard. Please try again.');
    }
  };
  

  

  // const copyLink = (view?: DiagramView, token?: string) => {
  //   const link = getLinkForView(token);
  //   navigator.clipboard.writeText(link);
  //   const lastPublishedTypeLocalStorage = LocalStorageRepository.getLastPublishedType();
  //   const viewUsedInMessage = view
  //     ? getMessageForView(view)
  //     : getMessageForView(lastPublishedTypeLocalStorage || DiagramView.EDIT);

  //   toast.success(
  //     'The link has been copied to your clipboard and can be shared to ' +
  //       viewUsedInMessage +
  //       ', simply by pasting the link. You can re-access the link by going to share menu.',
  //     {
  //       autoClose: 10000,
  //     },
  //   );
  // };


  const handleShareButtonPress = async (view: DiagramView) => {
    const token = tokenInUrl.length > 0 ? tokenInUrl : await publishDiagram();
    LocalStorageRepository.setLastPublishedType(view);

    if (token) {
      LocalStorageRepository.setLastPublishedToken(token);
    }

    copyLink(view, token);
    close();

    // Close sidebar if it's open and we're switching to collaborate view
    if (view === DiagramView.COLLABORATE && isSidebarDisplayed) {
      dispatch(toggleSidebar());
    
    navigate(`/${token || LocalStorageRepository.getLastPublishedToken()}?view=${view}`);
    }
  };

  const publishDiagram = async () => {
    if (!diagram || !isUMLModel(diagram.model) || Object.keys(diagram.model.elements).length === 0) {
      dispatch(
        displayError(
          'Sharing diagram failed',
          'You are trying to share an empty diagram. Please insert at least one element to the canvas before sharing.',
        ),
      );
      close();

      return;
    }

    let token = diagram.token;
    const diagramCopy = Object.assign({}, diagram);
    diagramCopy.title = 'New shared version ';
    diagramCopy.description = 'Your auto-generated version for sharing';

    try {
      const res = await DiagramRepository.publishDiagramVersionOnServer(diagramCopy, diagram.token);
      dispatch(updateDiagramThunk(res.diagram));
      dispatch(setCreateNewEditor(true));
      dispatch(setDisplayUnpublishedVersion(false));
      token = res.diagramToken;
      return token;
    } catch (error) {
      dispatch(
        displayError('Connection failed', 'Connection to the server failed. Please try again or report a problem.'),
      );
      // tslint:disable-next-line:no-console
      console.error(error);
    }
  };

  const hasRecentlyPublished = () => {
    const lastPublishedToken = LocalStorageRepository.getLastPublishedToken();
    return !!lastPublishedToken;
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Share</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <>
          <p>
            After sharing, this diagram will be accessible to everyone with access to the link for at least 12
            weeks.&nbsp;
            <OverlayTrigger
              placement="bottom"
              overlay={<Tooltip id="share-tooltip">Changing the diagram will extend the time period.</Tooltip>}
            >
              <span className="tooltip-icon">
                <InfoCircle />
              </span>
            </OverlayTrigger>
          </p>

          <div className="container mb-3">
            <div className="row">
              <div className="col-sm-12 col-md-6 col-lg-4 p-1">
                <button
                  type="button"
                  onClick={() => {
                    handleShareButtonPress(DiagramView.EDIT);
                  }}
                  className="btn btn-outline-secondary w-100"
                >
                  Edit
                </button>
              </div>
              <div className="col-sm-12 col-md-6 col-lg-4 p-1">
                <button
                  type="button"
                  onClick={() => {
                    handleShareButtonPress(DiagramView.COLLABORATE);
                  }}
                  className="btn btn-outline-secondary w-100"
                >
                  Collaborate
                </button>
              </div>
              <div className="col-sm-12 col-md-6 col-lg-4 p-1">
                <button
                  type="button"
                  onClick={() => {
                    handleShareButtonPress(DiagramView.EMBED);
                  }}
                  className="btn btn-outline-secondary w-100"
                >
                  Embed
                </button>
              </div>
              <div className="col-sm-12 col-md-6 col-lg-4 p-1">
                <button
                  type="button"
                  onClick={() => {
                    handleShareButtonPress(DiagramView.GIVE_FEEDBACK);
                  }}
                  className="btn btn-outline-secondary  w-100"
                >
                  Give Feedback
                </button>
              </div>
              <div className="col-sm-12 col-md-6 col-lg-4 p-1">
                <button
                  type="button"
                  onClick={() => {
                    handleShareButtonPress(DiagramView.SEE_FEEDBACK);
                  }}
                  className="btn btn-outline-secondary  w-100"
                >
                  See Feedback
                </button>
              </div>
            </div>
          </div>

          {hasRecentlyPublished() && (
            <fieldset className="scheduler-border">
              <legend className="scheduler-border float-none w-auto">Recently shared Diagram:</legend>
              <InputGroup>
                <FormControl
                  readOnly
                  value={getLinkForView()}
                  as={LocalStorageRepository.getLastPublishedType() === DiagramView.EMBED ? 'textarea' : 'input'}
                />
                <Button variant="outline-secondary" onClick={() => copyLink()}>
                  {LocalStorageRepository.getLastPublishedType() === DiagramView.EMBED ? 'Copy Embed' : 'Copy Link'}
                </Button>
              </InputGroup>
            </fieldset>
          )}
        </>
      </Modal.Body>
    </>
  );
};
