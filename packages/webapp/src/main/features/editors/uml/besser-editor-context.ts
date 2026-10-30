import { BesserEditor } from '@besser/wme';
import { createContext } from 'react';

export type BesserEditorContextType = {
  editor?: BesserEditor;
  setEditor: (editor: BesserEditor | undefined) => void;
};

// Provide a default no-op function for `setEditor`
export const BesserEditorContext = createContext<BesserEditorContextType>({
  setEditor: () => {
    throw new Error("setEditor is not defined. Make sure to wrap your component within BesserEditorProvider.");
  },
});

export const { Consumer: BesserEditorConsumer, Provider: BesserEditorProvider } = BesserEditorContext;
