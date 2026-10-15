import { useState } from 'react';

import {
  CLOSED_KG_GATE,
  type KgConsistencyGate,
  type KgDialogState,
  type KgRefineTab,
} from '../../../shared/kg/dialogState';

export function useDialogStates() {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Knowledge Graph dialogs. They render at the app root and are driven by
  // `useKgFlows`, which receives this state.
  const [isKgRefineOpen, setIsKgRefineOpen] = useState(false);
  const [isKgConvertMode, setIsKgConvertMode] = useState(false);
  const [kgRefineInitialTab, setKgRefineInitialTab] = useState<KgRefineTab | undefined>(undefined);
  const [kgConsistencyGate, setKgConsistencyGate] = useState<KgConsistencyGate>(CLOSED_KG_GATE);

  const kgDialogs: KgDialogState = {
    isKgRefineOpen,
    setIsKgRefineOpen,
    isKgConvertMode,
    setIsKgConvertMode,
    kgRefineInitialTab,
    setKgRefineInitialTab,
    kgConsistencyGate,
    setKgConsistencyGate,
  };

  return {
    isHelpDialogOpen,
    setIsHelpDialogOpen,
    isAboutDialogOpen,
    setIsAboutDialogOpen,
    isFeedbackDialogOpen,
    setIsFeedbackDialogOpen,
    isKeyboardShortcutsOpen,
    setIsKeyboardShortcutsOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    kgDialogs,
  };
}
