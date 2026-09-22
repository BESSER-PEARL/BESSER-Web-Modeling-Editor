import { useState } from 'react';

export function useDialogStates() {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
  };
}
