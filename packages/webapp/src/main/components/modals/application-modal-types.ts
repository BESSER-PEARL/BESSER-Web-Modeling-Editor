export type ModalContentType = keyof typeof ModalContentType;

export const ModalContentType = {
  HelpModelingModal: 'HelpModelingModal',
  ImportDiagramModal: 'ImportDiagramModal',
  InformationModal: 'InformationModal',
  LoadDiagramModal: 'LoadDiagramModal',
  CreateDiagramModal: 'CreateDiagramModal',
  CreateProjectModal: 'CreateProjectModal',
  ImportProjectModal: 'ImportProjectModal',
  CreateDiagramFromTemplateModal: 'CreateDiagramFromTemplateModal',
  ShareModal: 'ShareModal',
  CollaborationModal: 'CollaborationModal',
  DeleteVersionModal: 'DeleteVersionModal',
  RestoreVersionModal: 'RestoreVersionModal',
  EditVersionInfoModal: 'EditVersionInfoModal',
  CreateVersionModal: 'CreateVersionModal',
  ExportProjectModal: 'ExportProjectModal',
} as const;

/**
 * type of ModalProps.size
 */
export type ModalSize = 'sm' | 'lg' | 'xl' | undefined;

export type ModalContentProps = {
  close: () => void;
  onClosableChange: (closable: boolean) => void;
};
