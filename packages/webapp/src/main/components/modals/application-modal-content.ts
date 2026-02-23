import { ModalContentProps, ModalContentType } from './application-modal-types';
import { HelpModelingModal } from './help-modeling-modal/help-modeling-modal';
import { ImportDiagramModal } from './import-diagram-modal/import-diagram-modal';
import { InformationModal } from './information-modal/information-modal';
import { LoadDiagramModal } from './load-diagram-modal/load-diagram-modal';
import { CreateDiagramModal } from './create-diagram-modal/create-diagram-modal';
import { CreateProjectModal } from './create-project-modal/CreateProjectModal';
import { StartProjectModal } from './create-project-modal/StartProjectModal';
import { StartFromSpreadsheetModal } from './create-project-modal/StartFromSpreadsheetModal';
import { ImportProjectModal } from './import-project-modal/ImportProjectModal';
import { CreateFromTemplateModal } from './create-diagram-from-template-modal/create-from-template-modal';
import { FeedbackModal } from './feedback-modal/feedback-modal';

export const ApplicationModalContent: { [key in ModalContentType]: React.FC<ModalContentProps> } = {
  [ModalContentType.HelpModelingModal]: HelpModelingModal,
  [ModalContentType.ImportDiagramModal]: ImportDiagramModal,
  [ModalContentType.InformationModal]: InformationModal,
  [ModalContentType.LoadDiagramModal]: LoadDiagramModal,
  [ModalContentType.CreateDiagramModal]: CreateDiagramModal,
  [ModalContentType.CreateProjectModal]: CreateProjectModal, // Always map to the actual create project modal
  [ModalContentType.StartProjectModal]: StartProjectModal, // Entry point for new project
  [ModalContentType.StartFromSpreadsheetModal]: StartFromSpreadsheetModal,
  [ModalContentType.ImportProjectModal]: ImportProjectModal,
  [ModalContentType.CreateDiagramFromTemplateModal]: CreateFromTemplateModal,
  [ModalContentType.FeedbackModal]: FeedbackModal,
};
