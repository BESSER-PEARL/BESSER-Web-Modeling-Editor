
export type ModalContentType = keyof typeof ModalContentType;

export const ModalContentType = {
  HelpModelingModal: 'HelpModelingModal',
  ImportDiagramModal: 'ImportDiagramModal',
  InformationModal: 'InformationModal',
  LoadDiagramModal: 'LoadDiagramModal',
  CreateDiagramModal: 'CreateDiagramModal',
  CreateProjectModal: 'CreateProjectModal', // This will now map to StartProjectModal
  StartProjectModal: 'StartProjectModal',
  StartFromSpreadsheetModal: 'StartFromSpreadsheetModal',
  ImportProjectModal: 'ImportProjectModal',
  CreateDiagramFromTemplateModal: 'CreateDiagramFromTemplateModal',
  ShareModal: 'ShareModal',
  CollaborationModal: 'CollaborationModal',
  DeleteVersionModal: 'DeleteVersionModal',
  RestoreVersionModal: 'RestoreVersionModal',
  EditVersionInfoModal: 'EditVersionInfoModal',
  CreateVersionModal: 'CreateVersionModal',
  FeedbackModal: 'FeedbackModal',
} as const;

/**
 * type of ModalProps.size
 */
export type ModalSize = 'sm' | 'lg' | 'xl' | undefined;

export type ModalContentProps = {
  close: () => void;
  onClosableChange: (closable: boolean) => void;
};
