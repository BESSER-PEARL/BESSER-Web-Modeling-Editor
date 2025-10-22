import { ApollonEditor } from '@besser/wme';
import { createContext } from 'react';

export type ApollonEditorContextType = {
  editor?: ApollonEditor;
  setEditor: (editor: ApollonEditor) => void;
};

// Provide a default no-op function for `setEditor`
export const ApollonEditorContext = createContext<ApollonEditorContextType>({
  setEditor: () => {
    throw new Error("setEditor is not defined. Make sure to wrap your component within ApollonEditorProvider.");
  },
});

export const { Consumer: ApollonEditorConsumer, Provider: ApollonEditorProvider } = ApollonEditorContext;
