/** Opening the Help guide from anywhere; WorkspaceShell owns the (lazy) dialog and listens. */

export type HelpGuideSectionId =
  | 'class'
  | 'object'
  | 'state'
  | 'agent'
  | 'user'
  | 'gui'
  | 'quantum'
  | 'nn'
  | 'bpmn'
  | 'github';

export const OPEN_HELP_GUIDE_EVENT = 'wme:open-help-guide';

export interface OpenHelpGuideDetail {
  section?: HelpGuideSectionId;
}

export const openHelpGuide = (section?: HelpGuideSectionId): void => {
  window.dispatchEvent(new CustomEvent<OpenHelpGuideDetail>(OPEN_HELP_GUIDE_EVENT, { detail: { section } }));
};
