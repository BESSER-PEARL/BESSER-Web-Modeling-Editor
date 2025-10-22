import { ModalContentProps, ModalContentType } from './application-modal-types';
import { HelpModelingModal } from './help-modeling-modal/help-modeling-modal';
import { ImportDiagramModal } from './import-diagram-modal/import-diagram-modal';
import { InformationModal } from './information-modal/information-modal';
import { LoadDiagramModal } from './load-diagram-modal/load-diagram-modal';
import { CreateDiagramModal } from './create-diagram-modal/create-diagram-modal';
import { CreateProjectModal } from './create-project-modal/CreateProjectModal';
import { ImportProjectModal } from './import-project-modal/ImportProjectModal';
import { CreateFromTemplateModal } from './create-diagram-from-template-modal/create-from-template-modal';
import { ShareModal } from './share-modal/share-modal';
import { CollaborationModal } from './collaboration-modal/collaboration-modal';
import { DeleteVersionModal } from './delete-version-modal/delete-version-modal';
import { RestoreVersionModal } from './restore-version-modal/restore-version-modal';
import { EditVersionModal } from './edit-version-info-modal/edit-version-info-modal';
import { CreateVersionModal } from './create-version-modal/create-version-modal';
import { ExportProjectModal } from './export-project-modal/export-project-modal';

export const ApplicationModalContent: { [key in ModalContentType]: React.FC<ModalContentProps> } = {
  [ModalContentType.HelpModelingModal]: HelpModelingModal,
  [ModalContentType.ImportDiagramModal]: ImportDiagramModal,
  [ModalContentType.InformationModal]: InformationModal,
  [ModalContentType.LoadDiagramModal]: LoadDiagramModal,
  [ModalContentType.CreateDiagramModal]: CreateDiagramModal,
  [ModalContentType.CreateProjectModal]: CreateProjectModal,
  [ModalContentType.ImportProjectModal]: ImportProjectModal,
  [ModalContentType.CreateDiagramFromTemplateModal]: CreateFromTemplateModal,
  [ModalContentType.ShareModal]: ShareModal,
  [ModalContentType.CollaborationModal]: CollaborationModal,
  [ModalContentType.DeleteVersionModal]: DeleteVersionModal,
  [ModalContentType.RestoreVersionModal]: RestoreVersionModal,
  [ModalContentType.EditVersionInfoModal]: EditVersionModal,
  [ModalContentType.CreateVersionModal]: CreateVersionModal,
  [ModalContentType.ExportProjectModal]: ExportProjectModal,
};
